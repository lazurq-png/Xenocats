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
