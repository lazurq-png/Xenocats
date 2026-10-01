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

## D10 — T4: sound effects

Acceptance criteria from plan task 4: (1) synthesised with Web Audio, no audio
files; (2) a distinct sound for every cat's attack, plus waking up and
spawning; (3) a speaker toggle in a corner, on by default, remembered in
localStorage; (4) keyboard reachable and labelled; (5) audio only after the
first user gesture; (6) fails silently without Web Audio; (7) unit tests that
every cat type has its sounds; an e2e test for the toggle.

- `sounds.ts`: each sound is a list of tones (oscillator shape or white
  noise, glide, start, duration, gain). 20 distinct attack sounds keyed by
  effect id; one wake and one arrival sound shared in shape but pitched per
  cat type (`pitchFor`, ±½ octave), so "waking up and spawning" also differ
  per cat. The player creates the AudioContext only on the first gesture
  (see the gesture list under "After review"), and swallows every Web Audio
  error.
- Played from the cats provider: arrival when a cat enters `appearing`, wake
  on `waking`, attack when the cursor accepts the attack; Survival's landed
  attacks play the attack sound too (`Xenocats.sound`).
- The toggle (`SoundToggle`, bottom-right, `aria-label="Cat sounds"`,
  `aria-pressed`) mutes sound only; it is not an off switch for the cats (the
  plan's "no off switch" rule). Stored as `xenocats:sound` = `on`/`off`.
- After review: audio unlocks on `keydown`, `mousedown`, `pointerdown`,
  `pointerup`, `touchend` and `click` (on touch screens only the last three
  count as activation); a sound is skipped, not queued, while the context is
  still suspended (its clock stands still, so queued sounds would all fire at
  once). Fight cats make their arrival sound when they first appear; Survival
  plays the attack sound only when the effect is accepted. The toggle is
  `data-xenocat-ignore`, so page hits never move or hide it.
- Accepted (reviewer N1, Low): a context created on the very first gesture
  may still report `suspended` on the next frame, so that one first sound can be
  skipped; every later sound plays.

## D11 — T5: the cat field guide

Plan task 5: `/cats` shows, per cat type, stats kept in localStorage — times
met, attacks survived, tamed (task 2) — with empty-state wording for a new
visitor.

- **Met** = a cat of that type appeared: a dashboard/gallery cat entering
  `appearing`, or a Fight cat first showing up.
- **Attacks survived** = its attack hit you and you lived: a cat-layer attack
  the cursor accepted (they never end anything), or a Survival landing that did
  not end the game.
- **Tamed** = the Taming collection (`xenocats:tamed`, D6), now written through
  the guide store so the cards update at once.
- Stored as `xenocats:guide` = `{ typeId: { met, survived } }`; read through a
  validating parser; a small store (`getGuide`/`subscribeGuide`) keeps one
  object per stored state for `useSyncExternalStore` and notifies this tab on
  each write (other tabs via `storage`). Server render shows the empty guide.
- UI: a "Field guide" heading with a summary above the roster ("You have met N
  of the 20 cats" or, for a new visitor, an explanation of where cats come
  from), and on each card a Met / Attacks survived / Tamed list, or "Not met
  yet."

## D12 — Checkpoint 1 (T1–T5)

- **Locked mode now has browser tests.** Headless Chromium grants pointer lock
  and reports `movementX/Y`, so `fight.spec.ts` plays Survival under the lock:
  the game owns and draws the pointer, the fake cursor is hidden, a click
  banishes the cat under the locked pointer, and losing the lock while focused
  (what Esc does) ends the game. A tab/window switch (lock lost while not
  focused) still cannot be produced headless; the pause path is tested through
  `blur`.
- That test is a real-time game: a cat can land before the click, so it keeps
  playing (starting a new game if three landings ended one) until one click
  banishes a cat without losing a life. Not a retry of the test: every
  assertion still holds on the attempt that counts.
- **One sound player per page** (`sharedSoundPlayer`), and no AudioContext at
  all while sound is off: the cats provider mounts on `/dashboard` and on
  `/cats`, and a context per mount was never closed (browsers cap them).
- `fight.tsx`: the 100 ms "lock lost" timer is cleared on cleanup; a lock
  request that resolves after the section unmounted releases the lock and
  stops. The game dialog contains Tab / Shift+Tab (on its own buttons, or on
  itself when it has none).
- **Fight attacks under pointer lock do not hit page elements** (task 3's "every
  attack"), recorded rather than changed: the page is behind the game's 85 %
  opaque overlay and the effect runs on the game's own pointer, not the page's
  cursor; in fallback mode they go through the page's cursor and hit the page
  behind the overlay like any attack.
- Tests reviewed for relevance: no test of removed behaviour, no duplicate
  found; nothing deleted. One flake seen once in ~60 runs of `fight.spec.ts`:
  "Taming: a pointer moving at the cat makes it dodge" (not reproduced in 8
  further runs); left as is and noted.
- **CI failed on `c4df896`** (both browser-test jobs; checks job passed). Not
  reproduced locally: `CI=1 --workers=1` on the dev server and against
  `next start` both passed 54/54. CI logs need auth, so the cause is inferred:
  the only browser tests new in this checkpoint are the pause test and the
  pointer-lock test, and the likeliest difference is headless Chromium on
  Linux refusing pointer lock. Fix attempt 1: the lock test skips itself, with
  the reason, when the browser refuses the lock (the fallback path has its own
  tests). If CI still fails, the cause is elsewhere.
- **CI failed again on `53251eb`** (same two jobs): the lock-refusal skip did
  not fix it, so that hypothesis is eliminated as the (sole) cause. Fix cycle 2
  makes CI tell which test fails, as the workflow already intends for unit
  tests ("identifiable from the job's step names alone"): both browser jobs now
  run per-spec named groups, each even if an earlier one failed. It also found
  that CI's explicit unit groups never ran any of tonight's unit tests, nor the
  pre-existing `auth-config`, `dashboard`, `proxy-matcher`, `cat-art` and
  `cat-sprite` tests: all are now in a group, and a guard step fails CI if a
  test file is in no group. Locally the dodge test then flaked a second time;
  its poll could miss a dodge shown for a frame or two (a teleport lasts
  60 ms), so it now records every `data-doing` value with a MutationObserver.
  It is the likeliest CI culprit; the named steps will confirm or refute it.
  Reviewed (Request Changes → applied): each browser group keeps its own
  HTML report and traces (`PLAYWRIGHT_HTML_OUTPUT_DIR`, `--output`), since a
  Playwright run clears the previous run's; the guard matches whole names
  (`cat` no longer passes because of `cat-art`) and needs each spec in both
  browser jobs; it runs after the unit groups so it never skips lint or type
  check; browser groups run only if the browser install (hence the build)
  succeeded. actionlint clean.
- **CI cycle 2 (`fdbc6cd`) named the culprit**: only the "fight" browser group
  fails, in both jobs; every other group and all unit groups pass. Cycle 3
  hypothesis: in CI's headless Chromium `document.hasFocus()` is false, so
  losing the pointer lock correctly *pauses* the game (D3: a lost lock without
  focus is a window switch), while the lock test expected "game over". The
  test now checks the documented behaviour for whichever focus the browser
  reports; both branches were run locally (the unfocused one by faking
  `hasFocus`).

## D13 — T6: petting and poking a sleeping cat

Plan task 6: hovering a sleeping cat for 1 s makes it purr (a sound from task 4)
and delays its wake-up; clicking a sleeping cat wakes it early and angry, its
attack stronger by an amount set in the config.

- Petting lives in the pure engine (`cat-engine.ts`): the pointer resting on a
  sleeping cat's square for `petMs` (1000) purrs (`onPurr`, a per-cat-pitched
  `purr` sound) and makes it sleep on for at least `petSleepMs` (4000) after
  that purr; continued petting keeps it asleep. Moving off restarts the second.
- A click on a sleeping cat (`poke`, from a captured `pointerdown`) wakes it at
  once and marks it angry; it glows red. The click is not swallowed: it still
  reaches whatever is under the cat, as every click does (the cats never take
  clicks).
- "Stronger by an amount set in the config": `CAT_CONFIG.angryFactor` (1.5).
  `strengthen(effect, factor)` makes the effect last 1.5× as long (within the
  10 s cap), with 1.5× the blur and scale; only effects marked
  `amplify: 'offset'` also move the cursor 1.5× as far from the real pointer
  (see "After review" below). The wrapped effect still sees its own
  unstrengthened previous look, so one that builds on it (fall) does not
  compound frame after frame (unit-tested).
- Only cat-layer cats can be petted or poked; Fight game cats are never asleep.
- After review: (Medium) scaling the cursor's distance from the real pointer
  only makes sense for effects that draw the cursor at an offset from it —
  knockback, drift, jitter, drunk, decoys, teleport, fall, now marked
  `amplify: 'offset'`; the others (freeze, heavy, magnet, orbit, spiral,
  bounce, axis-lock…) only last longer and blur/scale more, so a strengthened
  freeze still freezes. (Low) petting needs the pointer on the page. (Low) a
  click pokes at the visible cursor (real pointer on touch screens) and not
  while an effect blocks clicks.
- After re-review (Low): a tap or pen pokes where it touched, a mouse click
  where the visible cursor is (a touchscreen laptop has both).

## D14 — T7: cat combos

Plan task 7: two cats waking close together, in place and time (both set in
the config), fuse their attacks into one combined effect; at most one combo at
a time, counting as the one active effect; at least 5 combos, each
unit-tested.

- "Waking close together": two cats that *start* waking (on their own, or
  poked awake) within `comboWindowMs` (1500 ms) and `comboDistance` (220 px,
  centre to centre) of each other, whose attacks have a combo, are paired in
  the engine. The first to be ready waits for the other (at most the 900 ms
  wake), then both pounce at once from between them with the combo's effect —
  one `cursor.attack`, so it is the one active effect. No new pair forms while
  a pair is waiting or attacking.
- Six combos (`combos.ts`), built from the two attacks with three pure
  combinators — `layer` (one effect applied to where the other puts the
  cursor, while both last), `chain` (one, then the other), `restyle`:
  Freeze + Bounce = Ice puck (frosted, ricocheting), Knockback + Magnet =
  Slingshot (flung, then reeled in), Reverse + Drunk = Hangover, Vanish +
  Teleport = Ghost jump (faint jumping cursor), Tiny + Giant = Pulsar (scale
  swinging between ¼ and 4×), Jitter + Blur = Static fog. Each has a unit test
  of its behaviour.
- Either cat angry → the combo is strengthened; both cats' attack sounds play
  and both count as survived in the field guide. Combos happen only among the
  page's cats (dashboard, gallery); Fight cats never sleep.
- After review: (Medium) combos had no page effect, so task 3's "every attack
  hits the page" broke for them → each combo has its own `PAGE_HITS` entry,
  tested. (Low) an angry combo now throws the cursor further where its parts
  do (`restyle` keeps its effect's `amplify`; Static fog is marked offset).
  (Low) pairing through natural waking is now tested as well as through pokes;
  the layer's combo wiring (sounds, field guide for both cats) is covered by
  reading only.

## D15 — T8: cats on touch devices

Plan task 8: on touch devices cats appear and attack page elements only
(task 3), centred on the last touch point; the fake cursor stays off; an e2e
test with a touch device profile.

- "Touch device" = no precise pointer (`(pointer: fine)` false), the same test
  that keeps the fake cursor off. Cats already appeared there; their attacks
  used to pounce at nothing.
- The cursor provider now remembers the last non-mouse `pointerdown` as the
  touch point. An attack with no fake cursor hits the page around that point
  (`hitPage`, same radius and effects) for the effect's duration, restored by
  a timer (and on unmount). Taps (`click`/`dblclick`/`contextmenu` with
  `detail > 0`) are blocked meanwhile, keeping task 3's "clicks stay blocked
  while elements are displaced"; keyboard-made clicks never are. One attack
  at a time, as with the cursor.
- No touch yet → the cat pounces at nothing and leaves, as before. Petting
  needs a hovering pointer, so it does not happen on touch screens; poking
  (tapping a sleeping cat) does, at the tap.
- After review: an attack whose touch point has nothing within reach hits
  nothing and blocks no tap (the page would otherwise look frozen); the touch
  path is chosen by the touch point itself, so a device switching from mouse
  to touch cannot leave cats waiting; `mousedown` is blocked too, so a tap
  cannot focus a displaced field; the e2e test proves the tap is blocked (no
  summon message) and works again after the effect (positive control).

## D16 — T9: invoice foreign key and indexes

Plan task 9: migration — `invoices.customer_id` references `customers(id)`
`ON DELETE RESTRICT`; indexes for the invoice search, date sorting and status;
check that the seed data satisfies the key.

- `db/migrations/0002_invoice_keys_and_indexes.sql`: the key, plus
  `invoices(customer_id)` (the search's and the list's join, and the lookup a
  customer delete needs), `invoices(date DESC)` (every list sorts by date),
  `invoices(status, date DESC)` (status filter, newest first — task 11).
  `ALTER`/`CREATE INDEX` only: it works on a database that already has data,
  and fails without changing anything if an invoice names a missing customer.
- **The search itself is not indexed.** It matches `ILIKE '%…%'` across names,
  emails, amounts, dates and statuses, which no B-tree index can serve; only a
  trigram index (`pg_trgm`) could. An extension needs database privileges and
  is installed per database, not per schema (the test schema is dropped and
  rebuilt), so whether to add one is a human's decision: Q2 (which also explains why the invoice search would need restructuring too).
- Seed: checked by a unit test (every invoice names a seeded customer, ids
  unique) and in a real database by the e2e global setup, which rebuilds
  `xenocats_test` from the migrations and seeds it (customers are inserted
  before invoices). CI's build job does the same on its own server. The run
  never applies it to `xenocats` (Q3).

## D17 — T10: customer create, edit and delete

Plan task 10: create, edit and delete customers following the invoice pattern
(Server Actions validated with zod, `auth()` checked in each action,
`useActionState` errors with `aria-describedby`); deleting a customer who still
has invoices is refused with a clear message (the key from task 9 enforces it,
the action reports it); e2e tests, each on its own customer.

- The customers page was still the course's placeholder ("Customers Page"),
  with an unused table component. Editing and deleting need a list, so the page
  now shows the table with the existing search and a Create Customer button,
  and each row has Edit and Delete (as the invoice list does).
- `createCustomer`, `updateCustomer`, `deleteCustomer` in `actions.ts`: each
  checks the session first, validates with `CustomerForm` (trimmed name and
  email, ≤ 255 like the columns) and the id with `CustomerId` (a UUID — the id
  is a client-supplied argument to a public endpoint), and returns only generic
  database errors. A delete the key refuses (PostgreSQL `23503`) returns "This
  customer still has invoices. Delete or reassign them first.", shown next to
  the button and tied to it with `aria-describedby`. An edit of a customer that
  no longer exists says so instead of redirecting as if it had worked.
- One form component serves create and edit (the invoice pattern has two near
  copies). `image_url` is not editable: avatars are drawn from the name, and
  new customers get an existing avatar file to satisfy the NOT NULL column.
- The edit page shows not-found for an unknown or malformed id.
- After review: (High) `/dashboard/invoices/create` was prerendered at build
  time with the seed customers, so under `next start` a new customer could
  never be invoiced (and the e2e test would fail in CI's build job; it passed
  locally only against `next dev`) → the page renders per request
  (`connection()`), and every customer write revalidates the customer list,
  the invoice list and the invoice form; verified with `E2E_SERVER=start` over
  a fresh build. (Medium) a new invoice dated today pushed the seed row the
  dashboard test looks for towards page 2 → that test searches for it.
  (Low) the customers pages got the invoices' `error.tsx`.

## D18 — Checkpoint 2 (T6–T10)

- **A press that pokes a sleeping cat is the cat's** (reverses D13's "the
  click passes through"). With T10's instant Delete buttons on every customer
  row, poking a cat asleep over one deleted that customer unseen. The
  `pointerdown` that pokes is swallowed, and so is the rest of that press up to
  its click; keyboard-made clicks (`detail` 0) never are. Unit test with a
  button under the cat; the pet-cat e2e test now checks nothing beneath got the
  click.
- **The customer delete guards itself**: `DELETE … WHERE id = $1 AND NOT
  EXISTS (invoices of $1)`; nothing deleted → "still has invoices" if the
  customer exists, "does not exist" otherwise. It no longer depends on
  migration 0002 having reached the database (Q3); the key still covers the
  race between the check and the delete.
- Tests added: the customer actions' refusals without a session, malformed
  ids never reaching SQL, trimmed inserts and revalidated views, the
  foreign-key and self-guard messages, generic errors (unit, mocked database);
  the combo wiring in the page layer (two cats waking together attack once with
  the combo's effect). Nothing removed.
