# Decisions — night-2026-10-01

## D1 — The formatting check reads LF-normalised content (run-wide)

`core.autocrlf=true` checks files out with CRLF while `.prettierrc` says
`endOfLine: lf`, so `prettier --check` fails on every unchanged checked-out
file. As in the previous run (`night-2026-09-25` D3), the gate checks
`tr -d '\r' < f | npx prettier --check --stdin-filepath f` for edited files;
new files are written with LF and checked directly.

## D2 — T1 acceptance criteria, and what "the locked pointer itself" means

Acceptance criteria derived from plan task 1:

1. A "Fight a cat" section on `/cats` with a Start button.
2. Start requests pointer lock; while locked, the game owns the pointer position
   (from `movementX/Y`) and cats attack that position.
3. Esc releases the lock and ends the game.
4. Cats arrive in waves; each wave has more cats, sooner (frequency) and faster
   (speed); never more than 5 on screen.
5. A cat reaching the pointer lands its attack and costs one of 3 lives.
6. Clicking a cat banishes it.
7. Score = waves survived; best score kept in `localStorage`.
8. Losing the lock other than by Esc (tab switch, window blur) pauses.
9. Pointer lock refused or missing → the game runs with the fake cursor.
10. Waves, lives, hits and scoring are pure and unit-tested.

"Attack the locked pointer itself, not a drawing of it": under pointer lock the
browser hides the system pointer and reports only movement, so any visible
pointer is drawn by the page either way. The difference made concrete
(`locked-pointer.ts`): the effect's output *is* the pointer's position — clicks
hit there, cats chase it — and when the effect ends the pointer stays where
the effect left it, rather than snapping back to an untouched "real" pointer as
the fake cursor does. Effects are reused unchanged through `cursor-controller.ts`.

Waves: a cat chases the pointer from a random screen edge (≥ 240 px away) and
lands when within 24 px. Wave n has `3 + (n-1)` cats, arrivals every
`1800·0.88^(n-1)` ms (≥ 350), speed `80·1.15^(n-1)` px/s (≤ 520). All in
`SURVIVAL_CONFIG`.

## D3 — Telling Esc from a tab or window switch

All three only show up as a `pointerlockchange` with no lock element; browsers
swallow the Esc keydown under lock. 100 ms after the lock is lost, the page
still focused and visible means Esc → end; otherwise → pause. `blur` and
`visibilitychange` pause as well (they also pause the fallback mode). Resume
needs a click, since pointer lock needs a user gesture; if the lock is refused
then, the game carries on in fallback mode.

## D4 — Cats on screen during a game

The 5-cat limit counts summoned gallery cats: the game gets
`5 − cats already on screen` as its room each tick (new `count()` on the cats
context). The Summon buttons are disabled while a game runs, so nothing can
push past 5 the other way. While a game runs the fake cursor is hidden in
locked mode (new `hide()` on the cursor context) and the game draws its pointer
with the shared `placeCursor` / `CursorShape`.

## D5 — `summon-status` test id on the roster's status line

The Fight section adds a second `role="status"` region to `/cats`, so three
existing tests' bare `page.getByRole('status')` became ambiguous (strict-mode
failure). They now target the roster's line by `data-testid="summon-status"`;
the asserted texts are unchanged.

## D6 — T2 acceptance criteria and the Taming rules

From plan task 2: (1) a Taming mode beside Survival with the same pointer lock
and fallback; (2) one cat at a time, which dodges the pointer; (3) holding the
pointer still on it for 2 s tames it; (4) tamed cats saved in `localStorage`
as a collection; (5) each cat type dodges in its own way, derived from its
attack; (6) unit tests for the dodging and the 2-second rule.

Rules chosen (`taming.ts`, `TAMING_CONFIG`):

- A pointer that *moves* within 140 px makes the cat dodge; then it ignores
  the pointer for 0.5 s.
- A pointer that keeps still (within 6 px) for 1 s makes the cat curious: it
  walks over (110 px/s) and stops beneath it. Without this, a cat that dodges
  every approach could never be held, so the plan's "holding still on it"
  needs a way for the cat to come to a still pointer.
- "On it" = within 36 px (half a cat) of its centre; "still" = within 6 px.
  Any movement beyond that resets the hold and, being near, triggers a dodge.
- Dodges (`DODGES`, keyed by the attack's effect id) come in 8 kinds — dash,
  blink, sidestep, hop, circle, mirror, drop, axis — and each of the 20 types
  has its own kind/distance/duration/reaction combination, picked to echo its
  attack (Void Tabby vanishes = blink; Lag Ragamuffin dashes after an 800 ms
  delay; Gravity Manx drops; Laser Ocicat moves along one axis; Mirror Sphynx
  jumps to its mirror image through the pointer…). A unit test asserts all 20
  are distinct.
- The collection is `{ typeId: count }` under `xenocats:tamed`; reading it
  drops malformed or unknown entries. Task 5 will display it; for now the
  Fight section shows the total.
- Taming has no end condition of its own: it runs until Esc / End game. Clicks
  do nothing in Taming.

## D7 — The e2e gate under machine load: one worker, with a control run

From ~15:30 the machine got slower (the user's own Chrome and `wudfhost`
taking most of the CPU; load 86% between runs). `npm run test:e2e` (4
workers) went from 60 s to 2.3–2.7 min and failed 3 timing-sensitive tests,
different ones each run (login redirect within 5 s, freeze/knockback/shake
positions, the sixth-summon count). A **control run on the T1 tip `481610b`,
with T2 stashed**, failed the same way (3 failed: Pulsar knockback, sixth
summon, demo login), so the cause is the environment, not the change.

While the load lasts the gate's e2e step is the same suite with less
contention: `npx playwright test --workers=1` (or `--workers=2`), which must
pass in full. Nothing is retried until green, no test is skipped or loosened
for it, and the plain `npm run test:e2e` is tried again at each task start.
CI runs the plain command on its own runner. T2 was also made cheaper to run
(D8), which did not by itself fix the slowness.

## D8 — Fight cats are moved by the loop, not by React (T2)

The game loop called `setState` every animation frame, re-rendering the whole
overlay 60 times a second (expensive in dev mode). It now moves cat elements
directly (`data-cat-id`, `placeCat`) and re-renders only when what React shows
changes. The reviewer checked that a re-render for any other reason cannot
put a cat back at an old position.

## D9 — T3: cats hit page elements (acceptance criteria and mechanism)

From plan task 3: (1) every attack also hits elements near the pointer —
buttons, links, text, cards, table rows, inputs — within a radius set in the
config module (`CAT_CONFIG.pageHitRadius` = 120 px, at most
`maxPageTargets` = 6); (2) only shake, tilt, blur, flip, glow, temporary
displacement, scrambled or swapped text, each matched to the attack
(`PAGE_HITS`, one per effect id); (3) everything reverts exactly when the
effect ends — layout, content, attributes, focus; (4) clicks stay blocked while
elements are displaced; (5) assistive technology keeps the real text; (6) never
the text or value of a focused or edited field; (7) unit tests for target
selection and exact restoration; e2e on `/cats` for a displaced element and
scrambled text restoring.

Mechanism (`page-hits.ts`):

- Hit in `XenocatCursorProvider.attack` when the attack starts; restored in the
  cursor's draw loop on the **first frame the cursor no longer blocks clicks**
  (same clock as the blocking), and on unmount — so (4) holds by construction.
- An effect only adds `data-xenocat-hit` / `data-xenocat-hit-text` attributes
  and `--xenocat-hit-*` custom properties; CSS rules in `global.css` keyed on
  them do the visuals. Restore puts the `style` attribute back as the exact
  string it was (absent stays absent) and removes the attributes. Focus is
  never touched.
- Text: never rewritten. The real text gets a transparent text fill and stays
  in the DOM (what AT reads); the scrambled/swapped text is a `::after` with
  `content: attr(data-xenocat-hit-text) / ''` (empty CSS alt text, so not read
  out). Text effects only go to elements whose only content is text, never to
  inputs, `contenteditable`, or anything containing the focused element; those
  shake instead.
- First attempt set the text colour as an inline custom property; Chrome then
  left `style=""` on those elements after the attribute was removed (traced:
  no script wrote it). Switching to `-webkit-text-fill-color` removed inline
  style from text hits entirely.
- Targets: elements matching controls/text/rows/cards (`HIT_SELECTOR`; cards
  are marked `data-xenocat-card` on the dashboard cards and gallery cards)
  within the radius, nearest first (smaller first on a tie), never one inside
  another already hit; anything `aria-hidden` or `data-xenocat-ignore` (the
  cats, the cursor, the Fight overlay) is skipped.
- "Restores exactly" is enforced against the page's own state at the start of
  the attack: if React changes an element's inline `style` during the attack,
  restore puts back the pre-attack string. No element the cats can hit has a
  React-managed inline style today; recorded as a known limit.
- After review: the restore also runs inside the click-blocking listener, so no
  click can arrive in the frame between the effect's end and the next draw; an
  element containing a focused field (input, select, textarea,
  contenteditable) is not hit at all, so the field being typed in is never
  blurred, flipped or pushed; boxes under 2 × 2 px (screen-reader-only labels)
  are skipped; tables are hit by row (`td`/`th` are not targets, since a cell
  always outranks its row).
