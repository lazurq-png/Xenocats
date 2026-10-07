# Decisions — night run 2026-10-07

Numbered D1, D2, … Each with its reason. Acceptance criteria derived for each task are recorded here.

## T1 — Database unit tests are opt-in

Acceptance criteria (from the task's words):
1. `tests/unit/data.test.ts` runs only when `DATABASE_TESTS=1`; otherwise every block in it skips, so plain `npm test` opens no database connection.
2. CI's "Database tests" step sets `DATABASE_TESTS=1`, so CI still runs them.
3. `CLAUDE.md` §9, `.claude/rules/testing.md` and the file's header comment describe the new behaviour.

**D1 — `E2E_NO_DATABASE=1` still skips them when opted in.** The task adds a gate; it does not ask to remove the old one, and `E2E_NO_DATABASE` is the documented "server unreachable" switch for every database-backed test. Keeping it is the smaller change. Only the exact value `1` opts in (the task says `DATABASE_TESTS=1`), so `DATABASE_TESTS=0` does not.

**D2 — the opted-in path is not run locally.** Running `DATABASE_TESTS=1` would write `xenocats_vitest` on the development server, which this run may touch only through the browser tests and the build (skill §3; the plan's "Databases" decision). Criterion 2 is proved by CI's "Database tests" step (polled), criterion 1's skip path by a local run.

**D3 — reviewer's observation, not acted on.** The reviewer approved with no findings and noted that if CI's `DATABASE_TESTS` were ever dropped, the "Database tests" step would pass green with every test skipped. True of any skip gate; making that step fail when the file is fully skipped is not asked for. Proposed as Q1.

## T2 — Each cat hits page elements the way it hits the pointer

Acceptance criteria (from the task's words):
1. No base wandering: an element under attack moves only if the attack moves the pointer, and does nothing the attack does not do to the pointer.
2. The listed examples hold: Smoke Bombay hides elements behind smoke in place; Pinball Devon flings them to bounce off the viewport's edges; Cryo Persian freezes (frost, no motion); Void Tabby hides in place; Munchkin Mite / Titan Forest Cat shrink / grow in place.
3. The rest derived from `effects.ts`, all 20 cats and the combos; recorded as one table (D4).
4. The calm hits follow the same mapping at their smaller reach.
5. Shaking only for an attack that shakes the pointer (`jitter`, and the combo built on it).
6. Everything reverts exactly; focused fields never touched; clicks as before (D9, Q2).
7. Unit tests: per effect, whether and how an element moves, as the table says. E2E on `/cats`, each cat in turn: Smoke Bombay leaves the box where it was while obscured; Pinball Devon displaces it and keeps it inside the viewport; every element back exactly.

**D4 — The mapping, and how it is enforced.** An element is attacked by running the cat's own effect on a pointer *held still* at the element's centre (`puppets.ts`): the effect's output position is where the element goes, and its look (hidden, blur, tint, scale, opacity) is how the element looks. So the table below is not a second copy of the behaviour that could drift: it is what the effects produce. `tests/unit/xenocats/puppets.test.ts` holds the same table (`TABLE`) and checks every row against the engine.

| Cat | Effect | What it does to the pointer | What it does to an element |
| --- | ------ | --------------------------- | -------------------------- |
| Void Tabby | `vanish` | hidden 3 s | hidden where it stands |
| Gravi Coon | `heavy` | moves at 30 % speed | nothing: a still pointer is not moved |
| Pulsar Siamese | `knockback` | flung 300 px away from the cat | flung away from the cat |
| Mirror Sphynx | `reverse` | moves the opposite way | nothing |
| Static Calico | `jitter` | shakes ±15 px | **shakes** (the only plain shaking attack) |
| Cryo Persian | `freeze` | frozen in place, iced | frosted in place, no motion |
| Nebula Ragdoll | `drift` | pushed steadily one way | drifts steadily one way |
| Quantum Kitten | `teleport` | jumps to a random spot, 3 times | jumps to a random spot, 3 times |
| Magneto Bengal | `magnet` | pulled towards the cat | pulled towards the cat |
| Orbit Abyssinian | `orbit` | circles the cat | circles the cat |
| Decoy Burmese | `decoys` | three decoy cursors beside it | nothing (decoys are extra cursors, not the pointer) |
| Wobble Fold | `drunk` | wobbles about | sways about where it stands |
| Munchkin Mite | `tiny` | shrinks to a quarter | shrinks in place |
| Titan Forest Cat | `giant` | grows fourfold | grows in place |
| Lag Ragamuffin | `delay` | follows 0.8 s late | nothing |
| Gravity Manx | `fall` | sinks to the bottom | sinks towards the bottom |
| Smoke Bombay | `blur` | blurry, half-transparent | hidden behind smoke in place (blur x3, grey, half-transparent) |
| Hypno Rex | `spiral` | spirals in to the screen's middle | spirals in to the screen's middle |
| Pinball Devon | `bounce` | flies off, bounces off the screen's edges | flies off (away from the cat), bounces off the viewport's edges |
| Laser Ocicat | `axis-lock` | moves on one axis only | nothing |
| combo: Ice puck | freeze + bounce | frosted, bouncing | frosted, bouncing |
| combo: Slingshot | knockback, then magnet | flung away, then reeled in | flung away, then pulled towards the cat |
| combo: Hangover | reverse + drunk | wrong way, swaying | sways |
| combo: Ghost jump | vanish + teleport | faint, jumping | faint, jumping |
| combo: Pulsar | tiny + giant | swells and shrinks | swells and shrinks in place |
| combo: Static fog | jitter + blur | fizzing in a haze | shakes, behind smoke |

Five cats (Heavy, Reverse, Decoys, Delay, Axis lock) now leave elements as they are: their attacks only change how the pointer follows the mouse, and an element has no mouse. That is the literal consequence of "an element only moves if the attack moves the pointer ... and nothing else"; raised as Q3 in case a visible equivalent is wanted.

Pinball's direction: the plan says "a random direction"; the effect launches the pointer away from the cat, so each element flies away from the cat, which differs from element to element. Kept to the effect, since the task asks for what the attack does to the pointer.

**D5 — Calm uses the same engine, not CSS approximations.** "The calm-intensity hits (`PAGE_HITS`) follow the same mapping at their smaller reach": calm's CSS kinds (shake, tilt, flip, push, scramble, swap) cannot express most rows (bouncing, orbiting, jumping, smoke), and a second hand-kept table would drift. So calm, and touch screens' hits, now run through the puppets too, at calm's `HitReach` (radius, max, no panels, nothing far off), half the distance (`fling: 0.5`) and size within 0.5-1.6x. `PAGE_HITS`, `applyHits`, `hitPage`, `hitText`, the scramble and swap text effects and their CSS in `global.css` are removed: nothing uses them any more, and scrambled or swapped text is not something any attack does to the pointer. Touch screens get animation frames of their own while a hit runs (there is no cursor draw loop there).

**D6 — Elements stay on screen.** A pointer is clamped to the viewport, so an element's box is too: the effect runs in a "screen" that is the span the element's centre may cover (`span()` in `puppets.ts`), so Pinball bounces the element's box off the viewport's edges. The span always includes where the element is, so one already partly off screen (or bigger than the screen) is never pulled in by an attack that does not move it, nor pushed further off. This replaces chaos's "things fly off the page": chaos still flings 2.5x further, within the screen.

**D7 — The weird twists are removed** (`twistFor`, `weird`, `wild`): rotating, flipping or squashing an element is not something an attack does to the pointer.

**D8 — Exact revert fixed in Chromium.** The new per-cat browser test found elements left with an empty `style=""` after every attack. The release code was unchanged by this task, so this was there before. Chromium writes CSSOM changes (`el.style.translate = ...`) to the attribute lazily, and `removeAttribute('style')` alone let a pending write land afterwards. `release()` now sets the saved text first, then removes the attribute if there was none. It shows only without a `MutationObserver` on the page: one with `attributeOldValue` forces the writes through and hides the bug (that is how the first probes missed it). Covered by the per-cat e2e tests; jsdom cannot reproduce it.

**D9 — Clicks: kept as they are** (Q2). The plan says "clicks stay blocked while elements are displaced", but click blocking was removed by hand in `d53f566` (2026-10-02, "redid so elements move independant of mouse"), and `fake-cursor.tsx` says "Clicks are never blocked". "Stay" asks for no change, so none was made.

**D10 — e2e helper.** Chromium reads `translate: 0px 0px` back as `"0px"`; the spec's parser treats a missing y as 0.

**D11 — T2 review (request changes), and what was done.**
1. *Medium, fixed.* The level's `fling` multiplied every effect's displacement, so at calm, in chaos and for panels the attacks that put the pointer somewhere (spiral, orbit, magnet, bounce, Ice puck) missed their target: a calm spiral stopped halfway, a chaos one overshot the middle, a calm orbit circled a point between element and cat. `fling` now applies only to attacks that throw the pointer some way from where it is (`amplify: 'offset'`), as `strengthen()` already does for an angry cat; the others put the element where they put the pointer at every level. Unit tests now check those rows at calm, chaos and as a panel; with the old rule four of them fail (checked by putting it back).
2. *Low, fixed.* The settings page's intensity descriptions (`app/ui/settings/cat-intensity.tsx`) said calm "only nudges" and chaos makes "things fly right off" the page; now "only hit what is near your pointer" and "things fly across it".
3. *Low, no code change.* Clicks are not blocked (D9): kept as an open question (Q2), to be reported as a requirement not met, not as decided.
Observations not acted on: a field focused *during* an attack keeps moving (as before this task); an element's home is measured once per attack, so scrolling mid-attack clamps from the old position (as before).
Re-review (read only): approve, no remaining findings. Its observation: the Slingshot and Hangover combos carry no `amplify` marker, so their knockback / wobble parts are not halved at calm (as an angry cat's `strengthen()` treats them too); if wanted, the fix belongs in `combos.ts`. Not changed: the task names no distance for combos.

## T4 — The fight games get pages of their own; a movement pad

Acceptance criteria (from the task's words):
1. Survival on `/cats/survival`, Taming on `/cats/taming`, each the whole game: a heading, the HUD, Start, the play area filling the page; no modal, no overlay, no `role="dialog"`.
2. `/cats`'s "Fight a cat" section is two links to them.
3. Everything else about the games unchanged: pointer lock and its fallback, Esc ends, losing focus or the lock pauses, best score and tamed collection, field-guide stats, sounds, at most 5 cats. Leaving the page ends the game and releases the lock. Both pages public.
4. Touch devices (no precise pointer, as the fake cursor detects it): both pages say the game needs a keyboard and mouse.
5. A movement pad: a component plus a pure module mapping touch to a walk direction, the same WASD gives; thumb-sized; hidden from assistive technology; no scroll or zoom while held. Not yet placed in a game.
6. Tests: unit tests for the pad's mapping (centre, each direction, diagonals, dead zone, release); e2e: `/cats` links to both pages, each page starts its game (fallback), the fight tests moved onto the new pages, a touch profile shows the notice.

**D12 — One `Fight` component, two pages.** `fight.tsx` keeps both games (they share the loop, pointer lock and HUD) and takes the game as a prop; the portal, `role="dialog"`, `aria-modal` and the Tab trap are gone. While a game runs, its play area is a full-page layer of the game's own page (`data-testid="fight-area"`, was `fight-overlay`) with the HUD along its top, as before but opaque. `fight-page.tsx` gives each page the cat and cursor providers (`autoSpawn={false}`: no cat comes on its own there, as on `/cats`) and the touch notice. The pages are server components with the `/cats` header, "Back to the cats" instead of "Back to the dashboard". `/cats/*` was already public in `auth.config.ts`.

**D13 — `/cats` no longer disables Summon during a game**: no game runs there any more, so the `disabled` plumbing in `cat-gallery.tsx` is removed; the tests that checked it went with it.

**D14 — Leaving the page.** Unmounting `Fight` (client navigation, or a reload) already released the lock and the fake cursor, and stopped the loop; it does not record a game-over (the best score is written only when a game ends in play), as before. A new e2e test leaves mid-game under pointer lock and checks the lock is released.

**D15 — The pad.** Eight ways only, the ones WASD can give: the pad builds the same held-key set and calls `walkDirection`, so a diagonal is exactly WASD's. 144 px across (a thumb needs about 45 px; room to aim it), a 56 px knob that follows the thumb within the pad, a dead zone of a quarter of the radius. `touch-action: none` on the pad, and while it is held a non-passive `touchmove` listener stops a second finger from pinching or scrolling the page. Pointer capture keeps a thumb that slides off the pad walking. Its browser test comes with its first use (task 5), as the plan says.

**D16 — T4 review (request changes), and what was done.**
1. *Medium, fixed.* With the dialog and its Tab trap gone, Tab from the play area reached what it covers (the header's links, Start) with no visible focus: Enter on a hidden "Back to the cats" would have left the game. While a game runs, everything outside the play area is now `inert` (the siblings along its path up to `<body>`; only what was marked is unmarked again). The pause test now presses Tab and Shift+Tab from Resume and checks focus never lands outside the play area; with the marking switched off it fails (checked).
2. *Low, fixed.* The new leave-the-page test demanded pointer lock; like its sibling it now accepts the fallback, checks the release only when locked, and checks nothing is left inert.
3. *Low, not done (optional).* The two game pages repeat the `/cats` page shell (skip link, header). A shared `app/cats/layout.tsx` would remove three copies; left for a task that touches those pages, as the reviewer allowed.
Re-review (read only): approve, no remaining findings.

## T5 — Taming with treats

Acceptance criteria (from the task's words):
1. Taming gets Survival's ranger, walked with WASD (desktop) or the movement pad (touch), with no gun; Taming is playable on touch, the pad shown only there; pointer lock and its fallback as in Survival; the pointer tames nothing.
2. Treats (fish, catnip, yarn, …) spawn at random spots, a few at a time, each vanishing after a while; how many, how often and how long in the config. Walking over one picks it up; one carried at a time; the HUD shows which. Emoji placeholders, styled for the dark theme.
3. One cat at a time. No treat: it flees the ranger (its `DODGES` way) and, from a configured range, attacks it with its own effect at a configured interval; the effect lands on the ranger as in Survival; no lives, nothing lost. Carrying a treat: it stops attacking and fleeing and comes; when they touch, the treat is given, the cat tamed, the treat used up, the next cat comes.
4. Unchanged: the tamed collection, the field-guide "tamed" stat, sounds, Esc, pause on focus/lock loss, at most 5 cats, visuals hidden from assistive technology.
5. Unit tests in `taming.ts` for spawning, expiry, pickup, one at a time, flee and ranged attack without a treat, approach with one, taming on touch, the treat used up; the 2-second-rule tests rewritten. E2E on `/cats/taming`, desktop fallback and a touch profile: walk to a treat, carry it to the cat, tamed, in the collection.

**D17 — The ranger lives in `fight.tsx`, the rules in `taming.ts`.** As in Survival, the ranger is a `LockedPointer` the game moves (so a cat's effect drifts, freezes or reverses it exactly as in Survival) and `taming.tick(now, ranger)` is pure: it returns what happened (`tamed`, `attack`, `picked`) and the component plays the attack on the ranger, the sounds and the field-guide record. The ranger walks with the held keys, or the pad when no key is held, at `rangerSpeed` (280 px/s, Survival's pace; its own config entry because task 6 replaces Survival's module).

**D18 — Config** (`TAMING_CONFIG`): treats every 1.8 s while fewer than 3, each lasting 9 s, picked up within 40 px; the cat flees a ranger within 160 px, attacks from within 320 px every 2.5 s (the first a moment after it arrives), comes at 170 px/s and is tamed at touching distance (half a cat plus 16 px). These are first guesses, not tuned by play: nobody has played it.

**D19 — Pointer and lock.** The pointer has no part in Taming any more, so the fake cursor is hidden throughout (as Survival hides it for its crosshair). Pointer lock is still requested on desktop, as the task says, so the system pointer is out of the way; on a touch screen it is not requested at all (there is no pointer to lock).

**D20 — Treats are emoji placeholders** (🐟 Fish, 🌿 Catnip, 🧶 Yarn, 🥛 Milk) in a small dark disc with a plasma ring, hidden from assistive technology with the rest of the play area; the HUD names the carried one in words ("Carrying: Fish", the emoji itself hidden from screen readers). **Waiting for a Superdesign pass**, with the ranger's empty-handed pose (`PlayerSprite` gained `armed={false}`, which only leaves the gun out).

**D21 — e2e.** The tests steer by what the page shows: the ranger's position (`data-x`/`data-y` on `fight-player`) and the treats' (`data-x`/`data-y`), re-aiming every 60 ms, so a cat's attack pushing the ranger about or reversing its controls only delays them. The touch test drives the pad with real touch events (CDP `Input.dispatchTouchEvent`). Repeated three times each: 12 of 12 passed. The "keeps away" test asserts the cat dodged at least once and nothing was tamed, not a minimum distance: a slow cat may be caught up with, briefly, which is allowed.

**D22 — T5 review (approve, three Low findings), and what was done.**
1. *Fixed.* In the desktop fallback (no pointer lock) Taming hid the fake cursor while nothing on screen followed the mouse, so End game had to be clicked blind. Taming's fallback now keeps the fake cursor (the pointer still plays no part: the mouse is ignored); Survival and anything locked hide it as before. D19 is corrected by this.
2. *Fixed.* A unit test's "comes to the ranger" checks sat inside `if (cat)` and could be skipped; they are unconditional now (still 19 of 19).
3. *Partly fixed.* On a touch screen the HUD said "Press Esc or End game to stop"; it now says "Tap End game to stop." A treat can still spawn under the movement pad or the wrapped HUD on a narrow phone, picked up but unseen: left for the Superdesign pass of the treats (treats expire after 9 s, so play is not blocked).
Not re-reviewed: three small changes made as the reviewer recommended; the gate ran again on them.

## Checkpoint 1

**D23 — Tests added at the checkpoint.** The movement pad component had no test of its own (its browser use came with T5, its scroll and zoom blocking only by reading): `tests/unit/xenocats/movement-pad-view.test.tsx` (jsdom) checks it is hidden from assistive technology, reports each change of way once and zero on release or cancel, ignores a second finger, blocks `touchmove` only while held, and stops the character when unmounted mid-hold; named in CI's jsdom group. Taming's "the attack lands on the ranger" had no test: the "keeps away" browser test now also requires an effect on the ranger, and was restructured after it failed twice in four runs for a reason of its own: walking at the cat, the ranger sometimes picked up a treat, and the cat then rightly came. It now reads the state in one instant, judges "never comes" only while empty-handed, starts a new game if a treat is picked up, and runs until it has seen a dodge and an attack (16 of 16 Taming tests over four repeats). No test was removed: none tests removed behaviour, duplicates another, or cannot fail.

**D24 — Checkpoint review (approve, four Low findings).** Fixed: three stale comments (`fight.tsx`'s render key, `puppets.ts` and `global.css` on why the page clips while elements move: elements now stay on screen, only a grown one overflows), a ternary in `fight-page.tsx` that could only be "Survival", and `README.md`'s routes (the two game pages). Not done: a line in the night-run skill on running the opt-in database tests — the run does not edit its own protocol; Q6.

## T6 — The arena, the hero and the horde

Acceptance criteria (from the task's words and the rules for tasks 6–11):
1. `/cats/survival` is the new game: a start screen with Start, the best time survived and the controls; the wave game retired (its modules and their tests deleted; what Taming uses kept).
2. An endless arena: the camera follows the hero; a subtle tiled floor; cats spawn just off screen on every side.
3. The hero (new SVG) walks with WASD/arrows or the pad; a health bar; contact drains it, each variety its own amount; brief invulnerability after a hit; elites (a configured share) also lay their xenocat effect on him, one at a time.
4. The horde: the 20 types walk at him; escalating spawns (a few in 30 s, dozens by 1 min, hundreds by 2½, as many as the frame rate allows by 4); a frame-rate guard stops adding cats below a floor.
5. The Laser Pointer: every few seconds it points at nearby cats; homesickness; enough sends a cat home.
6. The time goal (5 min) and the final cat; a results screen (time survived, cats sent home); the best time kept.
7. Rules: deadpan send-home tone; new art only for the game; Canvas 2D, sprites rasterized once, a spatial grid, pooled objects, a pure deterministic simulation (seeded, time passed in, fixed step); controls (Esc or lost focus pauses into a menu with Resume and Give up; no pointer lock); HUD as text, the canvas hidden from assistive technology; the state as text and `data-` attributes; sounds capped; storage versioned, corrupt reads as fresh; the ambient cat layer not on the game page.
8. Tests: unit — movement, contact damage and invulnerability, elite effects, the spawn curve on time (seeded), the frame-rate guard, the grid against brute force, the time goal; e2e (desktop and touch) — start, walk, the laser sends a cat home, the hero gives up, the results, the best time kept.

**D25 — Names, in the game's voice** (recorded as the plan asks): the hero is **the Keeper**; his health is **Resolve**; a cat's health bar is **Homesickness**; the counter is **Cats sent home**; the final cat is **the Matriarch** (no laser can send her home; she arrives at the time goal and ends the run when she reaches him). The currency is task 10's.

**D26 — Shape of the code.** `arena.ts` is the simulation (pure: seeded `Random`, input and time passed in, fixed 1/60 s steps); `arena-grid.ts` the spatial grid (cells of 64 px, lists reused between steps); `frame-guard.ts` the frame-rate guard (smoothed fps; no new cats below 40, again above 50, so it does not flicker); `arena-storage.ts` the best time (`xenocats:survival:v2:best-ms`; anything not a sane positive time reads as none); `arena-view.tsx` the canvas, HUD, menus, input and sounds; `arena-art.ts` the Keeper's SVG. The view runs as many fixed steps a frame as real time (times the speed hook) asks, at most 240 (beyond that the game slows rather than freezes). Cats are objects reused through a spare list (pooled), removed by swap; the laser and contact checks go through the grid. The 20 types' artwork is drawn once into an offscreen canvas each and blitted.

**D27 — The wave game retired.** Deleted (the plan lifts §3's "deleting a file you did not create" for this): `survival.ts`, `gun.ts`, `tests/unit/xenocats/survival.test.ts`, `gun.test.ts`, and the Survival half of `fight.tsx` (which is now Taming's alone). What Taming still uses moved to `walking.ts` (walk keys, `walkDirection`, facing, the game clock), with its tests in `walking.test.ts`. `PlayerSprite` keeps its gun drawing (`armed`), now unused by any game; left in place rather than widen the change. The old best score (`xenocats:survival-best`, waves) is not read: the arena's best is a time, under a new key.

**D28 — Elites' effects on the Keeper** (`HERO_EFFECTS`): freeze (Cryo); slow (Gravi ×0.35, Titan ×0.6, Lag ×0.5); reversed controls (Mirror); one axis (Laser Ocicat); pushed away (Pulsar, Pinball), towards the cat (Magneto, Orbit, Hypno), down (Gravity Manx) or one way (Nebula, Wobble Fold); a jump (Quantum Kitten); a shake (Static Calico); and, for the effects that only change how the cursor looks (Void, Smoke, Decoy, Munchkin), a veil: he is drawn faint, nothing else. Each lasts its own duration, at most 2.5 s; one at a time.

**D29 — Numbers** (first guesses, nobody has played it): Keeper 210 px/s, Resolve 100, untouchable 0.7 s after a hit, reached within 30 px; cats 45–95 px/s, homesickness 16–34, drain 4–11, each type its own (spread by the type's number); elites 4 %; the laser every 1.1 s, 300 px long, touching cats within ~28 px of its line, 20 homesickness a touch. Escalation targets: 3 at the start, 8 at 30 s, 45 at 1 min, 320 at 2½, 2500 at 4, 6000 (a hard cap) at 5; arrivals close half the gap a second. A seeded unit run (laser off, an unbreakable Keeper) reaches ≥2 by 20 s, ≥24 by 1 min, ≥200 by 2½ and ≥1000 by 4.

**D30 — Test hooks**: `?seed=` (a fixed random source) and `?speed=` (time up to 50× faster), read when a run starts; nothing is at stake in a single-player game. The play area carries `data-time`, `data-resolve`, `data-cats`, `data-sent-home`, `data-hero-x`/`-y`, `data-effect`, `data-weapons`, `data-screen`; the results `data-outcome`. The time goal is covered by unit tests only: a Keeper standing still in a browser run is worn down long before five minutes even at the speed hook, and adding an "unbreakable" hook was not worth it.

**D31 — Sounds** through the existing sound module (synthesised; T3's recordings never landed): a cat sent home purrs, a hit plays the cat's attack, the Matriarch's arrival plays Titan Forest Cat's wake-up; at most 3 sounds start in any 300 ms. The run's first click unlocks audio.

**D32 — Drawn by the run, not seen** (for a later Superdesign pass): the Keeper (`arena-art.ts`), the floor's tiles, the laser beam, the beamed-home column of light, the elites' violet ring, the homesickness bars. The Matriarch is Titan Forest Cat's own artwork drawn four times larger with a violet glow, not new art.

**D33 — The field guide** still counts: each type once a run as it is first met, and an attack that hit and did not end the run as survived (the wave game did both).

**D34 — T6 gate and review (request changes), and what was done.**
- *The gate's first run failed* in `tests/unit/affected-tests.test.ts` ("gives every spec an area"): the selector reduces `/cats/survival` to the `/cats` area but only recognised a spec's path for an area written exactly as that area, so `survival.spec.ts` (which visits `/cats/survival` only) reached no area. Fixed in the selector (`scripts/affected-tests.mjs`, `specAreas`): a longer path counts for the area it belongs to (`/cats/survival` for `/cats`) and still not for another's (`/dashboard/invoices` is not `/dashboard`); a case added. Because the selector changed, this task's gate ran every suite in full (skill §2.1).
- *Medium, fixed:* the frame-rate guard could refuse from the first frame on a 30 fps screen (Low Power Mode, Energy Saver) and leave the arena empty. The first `cats.guardFree` (40) cats now come whatever the guard says; it only holds back the growth beyond. Test: a guard that refuses throughout still gets exactly 40.
- *Medium, fixed:* cats walk onto the Keeper's exact point, and a laser aimed at a cat at distance 0 had no direction (every cat near him touched, all round). He now points the way he faces when the nearest cat is on him; only cats in front, along the beam, are touched. Test: a cat on him, others behind, none behind touched; it fails with the old code (checked).
- *Low, fixed:* the one-effect test now has elites of two kinds reaching him repeatedly (untouchable only 0.1 s): while one effect lasts it stays the one.
- *Note, fixed:* a Keeper whose Resolve runs out after the time goal (the Matriarch still on her way) now reads as the goal reached, not "spent". Test added.
- *Note, recorded:* the HUD has no level yet — levels come with task 7. Cats have no separation (they stack on the Keeper): not asked for; left.
Re-review (read only): approve, two Low findings, both fixed. (1) With the fallback aim, the cat on the Keeper could sit a hair behind him and escape the beam aimed at it: cats within half a pixel behind count as in front, and the test now checks the cat on him is touched. (2) The one-effect test could fail on a legitimate hand-over (an effect ending and another landing in the same step): a change is now a violation only while the first effect may still last (`effectMaxMs`). Note acted on: the goal's results text no longer names the Matriarch, since Resolve spent after five minutes also counts as the goal ("Five minutes, and the night is survived.").

## T7 — Experience, level-ups and the arsenal

Acceptance criteria (from the task's words):
1. Sent-home cats drop experience gems; the hero collects them within a pickup radius; an experience curve gives levels.
2. A level-up pauses the game and offers 3 choices (4 with a passive that adds one) of new weapons, weapon levels or passives, from what is not yet at its maximum; weapons to level 8, passives to 5; up to 6 weapons and 6 passives held.
3. Weapons, all automatic: Laser Pointer (now with levels), Cat Treats, Vacuum Cleaner, Spray Bottle, Yarn Ball, Can Opener, Hairball, Thunderous Vacuum, Laser Pointer Deluxe — each as the task describes.
4. Passives: Rubber Chicken (speed), Battery, Catnip, Scissors (task 9's ingredients, each useful alone: cooldown, area, count), and standard ones (max health, recovery, pickup radius, might) named in the game's voice.
5. Unit tests: the curve; the offer (never maxed, never beyond the slots); each weapon at level 1 and its top level (targets, area, cooldown); a seeded 5-minute run with automatic choices ends with the screen full of attacks. E2E: a level-up dialog appears, is picked by keyboard (1–4) and by tap on a touch profile, and the game resumes with the new weapon held.

**D35 — Shape.** `arsenal.ts` (new, pure data and rules): the nine weapons' stats for levels 1–8 (each value interpolated from level 1 to level 8), nine passives, the modifiers they add up to, the experience curve (`xpToNext`: 5 to reach level 2, then rising), and the offer (`offerChoices`: new weapons/passives while slots remain, the next level of what is held, never anything at its highest; distinct, at random; with nothing left, "A Moment of Rest" gives back 30 Resolve). `arena.ts` makes the weapons act: damage only adds Homesickness, and once a step every cat homesick enough is swept home (so the grid's indices stay valid within a step), leaving a gem. Gems within the pickup radius fly to him; experience brings levels; a level with a choice pending stops the simulation (`step` does nothing) until `choose(i)`; several levels at once give one choice after another. Thrown things are pooled like the cats.

**D36 — How each weapon behaves** (a sentence each, as built): Laser Pointer — beams at the nearest `count` cats, touching everything along each; Cat Treats — a spread aimed at the nearest cat; Vacuum Cleaner — now and then draws every cat within reach a share of the way in (never onto him); Spray Bottle — droplets in a wide arc the way he faces; Yarn Ball — balls that bounce off the screen's edges, touching every cat they pass; Can Opener — blades circling him, homesickness a second to whatever they pass through; Hairball — one ball at the nearest cat that bursts into `count` smaller ones; Thunderous Vacuum — a zone round him, homesickness a second; Laser Pointer Deluxe — a beam that leaps from cat to cat, `count` times.

**D37 — Names in the game's voice** (recorded as the series' rules ask): the standard passives are **Wool Sweater** (more Resolve), **Warm Milk** (Resolve returns), **Long Whiskers** (gathers experience from further), **Stern Look** (might: more homesickness a touch); the one that adds a fourth choice is the **Lucky Bell** (one level only — the exception to "passives to 5"); with nothing left to offer, **A Moment of Rest**.

**D38 — Numbers and the bugs the tests found.** First guesses, nobody has played it; two fixed because the tests caught them: the stats table rounded every value, so the Vacuum's pull share (0.35–0.6) became 0 and it pulled nothing (speeds now keep two decimals); and the Can Opener at level 1 sent nobody home (cats walk through its ring onto him; its damage is now 55–110 a second, blades 20 px). Gems are picked up within 100 px (was 70 in T6's config, before gems existed), so a zone weapon's kills can be gathered. To make "the screen full of attacks" true in a late, dense crowd (where every thrown thing was spent the instant it left), Cat Treats and Spray Bottle reach more and pierce more at their top levels (treats 3→9, pierce 2→5; spray 6→16, pierce 2→4), and hairball bits pierce 2. The seeded 5-minute test (choices made weapons-first, the Keeper walking a circle as a player would, gathering) ends at level >20 with all six weapon slots full and more than 30 attacks alive at once.

**D39 — The level-up dialog**: a real modal dialog (`role="dialog"`, `aria-modal`, labelled "Level N. Choose one.", described by how to choose); focus moves to the first choice and back to the play area after; 1–4 pick, the arrow keys move focus, Enter or Space picks (they are buttons), a tap picks. Esc does nothing while a choice waits (the run is already stopped). The HUD shows the level and an experience bar; the play area carries `data-level` and `data-weapons` (`id:level` pairs). A level-up plays an arrival chirp through the capped sounds.

**D40 — e2e.** A run's tests that are about something else take any level-up's first choice and play on (`playOn`), and pause with a loop that takes it first, since a level-up can arrive at any moment at the speed hook. The level-up tests walk the Keeper (keys, or the pad on touch) so gems are gathered, then check the dialog, its focus and arrow keys, that the run waits, and that the chosen weapon is held at the level the choice gave (`data-level` on each choice). 12 of 12 over two repeats.

**D41 — Drawn by the run, not seen** (for the Superdesign pass): gems (violet, lime for an elite's), the shots (treats amber, droplets blue, yarn pink, hairballs brown), the Can Opener's blades, the Thunderous Vacuum's zone; the level-up dialog uses the site's existing panel and button styles.

**D42 — T7 review (approve, four Low findings), all fixed.**
1. Pierce was off by one: a shot was spent only below zero, so it touched one cat more than its table says (a hairball burst on its second cat). It is now spent at zero; the table values stand as written (treats 2→5, spray 2→4, bits 2). A test checks, at levels 1 and 8, that a flying shot always has `touched + pierce` equal to its table's pierce and never flies on with none left; it fails with the old rule (checked). The five-minute "screen full of attacks" test still passes after the change.
2. The behaviour tests ran mostly at level 1: they now run at 1 and 8 — each firing is exactly its count of beams, treats, droplets, yarn balls and chain jumps, a hairball bursts into its count of bits, and every weapon that fires waits its cooldown between firings (and no more, with cats always in reach). A `fired` event per firing makes this measurable.
3. Every "all cats in range" query allocated and sorted; they now use `within()`, which fills one reused list in no order. `nearest()` (sorted, allocating) is left for the count-limited aims (beam, chain, the spread's target).
4. Several levels gained at once all showed the final level in the dialog's heading; the arena now says which level each waiting choice is for (`choiceLevel`), and the heading uses it.
Observations recorded, not changed: the Vacuum Cleaner mostly brings cats closer (little homesickness at level 1) — the task asked for exactly that; the five-minute test runs at 50 ms steps for speed, not the game's 1/60 s.
Re-review (read only): approve, no remaining findings (the Vacuum Cleaner's balance stays a design point for a human).
