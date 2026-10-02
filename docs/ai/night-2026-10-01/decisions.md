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

## D19 — T11: invoice status filter

Plan task 11: filter the invoice list by status in the URL, next to search,
kept through pagination and combined with search.

- `?status=paid|pending` beside `?query=`; anything else (or nothing) shows
  every status (`parseStatusFilter`, a zod enum). Both queries add
  `AND (status IS NULL OR invoices.status = status)` after the search's `OR`s,
  parenthesised, so search and status combine; it is a parameter, never SQL
  text. The `(status, date DESC)` index from task 9 serves it.
- A labelled `<select>` (`StatusFilter`, "All statuses / Paid / Pending")
  beside the search box, writing the URL the way `Search` does; changing it
  goes back to page 1. Pagination already carries every URL parameter, so the
  status survives it untouched. Task 14 adds Overdue.

## D20 — T12: invoice detail page and delete confirmation

Plan task 12: an invoice detail page, and a confirmation dialog before
deleting (an accessible dialog: focus trapped and restored, Esc cancels).

- `/dashboard/invoices/[id]`: the customer (avatar, name), status, amount,
  date, the customer's email and the invoice number, with Edit and Delete;
  not-found for an unknown or malformed id. Each list row gets a View link.
- The confirmation is a native `<dialog>` opened with `showModal()`: the page
  behind is inert, Esc fires `cancel` and closes it, and closing returns focus
  to the trash button that opened it. Tab and Shift+Tab are also wrapped on its
  two buttons explicitly; Cancel has the focus when it opens. Its accessible
  name and description come from its heading and text ("Delete this invoice?",
  "The invoice for … will be deleted"). Deleting from the detail page returns
  to the list.
- `deleteInvoice` now validates its id (a UUID) before any SQL, like the
  customer actions.
- **Bug found by the new browser tests, fixed here:** `createInvoice` and
  `updateInvoice` stored `amount * 100`, which is not a whole number for about
  15 % of amounts in floating point (10000.37 → 1000037.0000000001); the
  INSERT into the integer column then failed, and the form silently reset
  (the action's general message is not shown). Now `Math.round(amount * 100)`,
  with a regression test that fails without it.
- After review (Approve, three Lows, all applied): deleting from the detail
  page uses `deleteInvoiceAndReturn`, which redirects to the list itself (no
  404 flash of the deleted page); after a delete from the list, focus goes to
  the search box; while a delete runs, Esc and Cancel do nothing, so a failure
  is still shown.

## D21 — T13: CSV export

Plan task 13: export the currently filtered invoice list as CSV through a
route that checks `auth()` itself, with values escaped for spreadsheets
(formula injection).

- `GET /dashboard/invoices/export?query=&status=` (a route handler): returns
  401 without a session before reading anything — the proxy already sends a
  signed-out visitor to the login page for `/dashboard/**`, but the route does
  not rely on it. Same filters as the list (`parseStatusFilter`, the same
  query), no pagination, newest first; more than 10 000 matching rows is
  refused with 422 rather than cut short.
  Columns: Date (YYYY-MM-DD), Customer, Email, Amount (dollars, 2 decimals),
  Status. `Content-Disposition: attachment`, `Cache-Control: no-store`, a UTF-8
  byte-order mark so Excel reads it as UTF-8.
- `app/lib/csv.ts`: a text cell that starts with `=`, `+`, `-`, `@` or their
  full-width forms, possibly after spaces or control characters, or that starts
  with a tab, carriage return or line feed, gets a leading apostrophe (OWASP's
  CSV-injection advice);
  then RFC 4180 quoting for quotes, commas, line breaks and edge spaces.
  Numbers are written as they are; amounts are formatted text starting with a
  digit, so never prefixed.
- An "Export CSV" link beside the filter carries the current search and status.
- After review (all three findings taken; the reviewer's notes are in the T13
  progress entry):
  - Formula detection also looks past leading spaces and control characters,
    takes a leading line feed, and covers the full-width `＝ ＋ － ＠`.
  - No silent truncation: the query fetches 10 001 rows; if there are more
    than 10 000, the route answers 422 with "narrow the search or the status
    filter" instead of a file that looks complete.
  - The link has no `download` attribute, so an expired session shows the
    login page instead of saving it as a file; `Content-Disposition` still
    makes a download.
  - The export-only 200-character query cap is gone: the export takes the
    same query the list does.

## D22 — T14: invoice due dates and overdue

Plan task 14: a due date (existing rows derived from their date), "Overdue"
shown for unpaid invoices past it and filterable, seed data updated.

- **Due date = invoice date + 30 days.** Smallest reading: the task names no
  terms and no form field. `0003_invoice_due_dates.sql` adds the column,
  fills existing rows with `date + 30`, then makes it `NOT NULL` with a check
  `due_date >= date`. Its default, `CURRENT_DATE + 30`, keeps an insert from
  the app before the migration valid and correct (that app dates invoices
  today). `createInvoice` sets it explicitly (`date + 30`, in SQL); editing an
  invoice changes neither date. Editable terms: Q4.
- **Overdue is derived, never stored**: `status = 'pending' AND due_date <
  CURRENT_DATE`, one SQL fragment in `data.ts`, so it cannot go stale and
  needs no job to update it. `CURRENT_DATE` is the database's day; invoices
  are dated with the UTC day (unchanged), so around midnight the two can
  differ by a day — accepted.
- **Three disjoint states.** A row's pill says exactly one of Paid, Pending
  (unpaid, not yet due) or Overdue (a filled lime pill, in place of Pending).
  The filter has the same three options; `pending` no longer includes overdue
  invoices, so each option shows what its rows say. One fragment
  (`matchesStatus`) serves the list, its page count and the CSV export. The
  dashboard's totals still count overdue invoices as pending (they are
  unpaid); the text search does not match the word "overdue" (the filter
  does).
- **CSV export** gains a Due column after Date; its Status column says
  `overdue` as the list does.
- **Seed**: every seeded invoice has `due_date` = its date + 30. All seeded
  invoices date from 2022–2023, so every seeded unpaid invoice now shows as
  Overdue. The status-filter browser test now checks Overdue on the seed rows
  and Pending on an invoice of its own (new today, due in 30 days).
- Not applied to `xenocats` (plan rule): Q3.

## D23 — Checkpoint 3 (T11–T15)

- **Tests added**: the seed's due dates against the database's check; the
  shape of migration 0003 (add, fill, then require; nothing dropped); the
  status pill (Overdue only for unpaid, never over Paid) as a unit test
  (`tests/unit/invoice-status.test.tsx`); the pending filter excluding
  overdue invoices (browser). The migration's backfill is not run against a
  table that already holds rows by any test: the e2e setup migrates an empty
  schema, then seeds. T16 (database tests) is where that belongs.
- **No test removed**: the delete test in `invoices.spec.ts` overlaps
  `invoice-detail.spec.ts` but adds the after-reload check, and the task
  named delete.
- **Reviewer finding 1 (Medium), fixed**: T15's edit test marks a new
  invoice paid while T11's pagination test reads the paid pages, so page 1's
  last row could move to page 2 → page 2 must show *some* invoice page 1 did
  not, every row paid.
- **Finding 2 (Low), fixed, with a browser test that failed before it (2/2)**:
  deleting from the detail page flashed "could not be deleted" — Next rejects
  the action's promise with its redirect, which the dialog's `catch` took for
  a failure → `unstable_rethrow` first, so Next follows the redirect.
- **Finding 3 (Low), recorded as Q5**: "Pending" in the list vs. the
  dashboard totals; a product decision, no task names those figures.

## D24 — T16: database integration tests, and where the run may run them

Plan task 16: Vitest tests for every query in `app/lib/data.ts` against the
test schema, with their own schema or rows, part of `npm test`, skipping
without a database.

- **One file, its own schema.** `tests/unit/data.test.ts` drops and rebuilds
  `xenocats_vitest` (through `scripts/db.mjs reset`, which refuses a
  non-private host) when it runs, then imports `data.ts` against it. The
  browser tests' `xenocats_test` is never touched, so the suites cannot
  collide. One file, so its tests run in order: the seed-only tests first
  (exact values, computed from `placeholder-data.ts`), then a block that adds
  its own customer and invoices (pending vs. overdue) and deletes them after.
- **The migration backfill** (left open by checkpoint 3): a second scratch
  schema, `xenocats_vitest_migrations`, gets 0001 and 0002, rows without a due
  date, then 0003; the test checks date + 30 on those rows, the default for
  an insert that names none, and the check constraint. Dropped afterwards.
- **Skips** without a URL (environment, else `.env`, which the file parses
  without loading into its environment) or with `E2E_NO_DATABASE=1` — the
  existing switch for "no database", so one variable covers both suites.
- **Conflict with the run's rules, resolved in their favour.** The night-run
  skill (§3) lets the run reach the development database *only* through
  `npm run test:e2e` and the build, and no plan lifts that rule. So the run
  never runs this file against it: every `npm test` the run makes from here
  on sets `E2E_NO_DATABASE=1`. The tests run in CI instead, in the *build*
  job, against that job's own throwaway PostgreSQL (`Database tests` step,
  at the end of the job, so a failure there hides no other result), and the
  run checks that step through the sanctioned read-only `/jobs` lookup. Q6
  asks a human to confirm the default (`npm test` touching the database when
  `.env` has one).
- Docs that described the database's users updated: `CLAUDE.md` §9,
  `.claude/rules/testing.md`, `.claude/rules/database.md`.

## D25 — T17: login lockout

Plan task 17: after N failed logins for one email, refuse that email for M
minutes; N and M in config; stored in a new table (migration).

- **Config = the environment**, as for the app's other settings:
  `LOGIN_MAX_FAILURES` (N, default 5) and `LOGIN_LOCK_MINUTES` (M, default
  15); anything but a whole number above zero falls back to the default
  (`app/lib/login-limit.ts`, documented in the README). Not added to any
  `.env*` file: the run may not touch them.
- **Table `login_failures`** (`0004_login_failures.sql`, new, changes nothing
  existing): email (trimmed, lower-cased) → attempts since the last success
  or since a lock ran out, and `locked_until`.
- **Per email, whether or not a user has it**: a lockout reveals nothing about
  which emails exist, and a locked email is refused even with the right
  password, which is never looked at.
- **Every attempt is counted before its password is compared**
  (`claimAttempt`: one `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`),
  and only attempts 1..N may compare. Concurrent attempts each get their own
  number, so a burst lets exactly N through. (The first version checked the
  lock, compared, then counted the failure: the reviewer showed that all
  attempts in flight before the Nth failure was written got compared.) The
  Nth attempt sets the lock as it is counted; if its password was right, the
  success deletes the row, lock included. Attempts during a lock are counted
  too (and refused). A lock that has run out restarts the count at 1.
- **Raising `LOGIN_MAX_FAILURES` while an email is locked** lets it compare
  up to the difference early (the limit is held by the count): an operator
  action, not an attacker's; accepted (reviewer, Low).
- **The message** for a locked email: "Too many failed logins for this email.
  Try again later." (the time left differs from lock to lock), carried as the
  `code` of a `CredentialsSignin` subclass, which Auth.js passes through
  unchanged to `signIn`'s caller.
- **Not done (outside the task's words)**: limiting per IP address; pruning
  rows for emails that never succeed (an attacker spraying addresses grows the
  table by one row per address); equalising the time an unknown email takes
  (it skips the password hash, as before this task). Q7.
- **Tests**: a failed login for the demo user would now count towards
  locking it, which parallel tests log in as; so the dashboard spec's
  wrong-password test now uses an unknown email, and wrong passwords for a real
  user are in `login-limit.spec.ts`, each test on a user it creates (plan rule).

## D26 — T18: security headers

Plan task 18: Content-Security-Policy and the other standard headers in
`next.config.ts`, compatible with Next, the cats' inline styles and Web Audio;
a browser test that they are present and the pages still work.

- **Static policy, as the task places it** (`next.config.ts` `headers()`, on
  every path). A static policy cannot carry a per-request nonce, so Next's
  inline scripts (flight data) need `script-src 'unsafe-inline'`; the inline
  `style` attributes (cats, charts, avatars) and next/font's style tags need
  `style-src 'unsafe-inline'`. A nonce-based policy would need the proxy to
  set the header per request and every page rendered dynamically — a larger
  change than the task, Q8.
- **Everything else is `'self'`**: no external origins are loaded (fonts are
  self-hosted by next/font, images come from `/public` and `/_next/image`,
  sounds are synthesised — CSP does not govern Web Audio). `img-src` also
  allows `data:` (the form plugin's SVG icons); `blob:` was dropped after
  review, as nothing uses it. `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`.
- **Dev only**: `'unsafe-eval'` (React's dev tooling) and `ws:`/`wss:` (hot
  reload), when `NODE_ENV` is `development` — never in a build.
- **Other headers**: `X-Content-Type-Options: nosniff`, `X-Frame-Options:
  DENY` (for browsers without `frame-ancestors`), `Referrer-Policy:
  strict-origin-when-cross-origin`, `Strict-Transport-Security` (2 years,
  subdomains; ignored over plain HTTP, so harmless on localhost; no
  `preload`, a decision for whoever owns the domain), `Permissions-Policy`
  turning off camera, microphone, geolocation, payment and USB, none of which
  the app uses. Pointer lock (the fight) is not a Permissions-Policy feature.
  No `upgrade-insecure-requests`: it would break `next start` over HTTP.
- **Test** (`security-headers.spec.ts`): the headers on four pages; the
  public pages, three dashboard pages (logged in) and `/cats` with a summoned
  cat load, hydrate and react with no CSP violation and no page error. A
  violation is caught twice over: the DOM's `securitypolicyviolation` event,
  relayed to the console by an init script, and Chrome's own console report;
  a fifth test injects an outside image and checks that the policy blocks it
  and the watcher reports it. The whole browser suite (cats, sounds, forms)
  also runs under the policy.

## D27 — T19: change password

Plan task 19: a settings page where the logged-in user changes their
password; current password required, new one validated, bcrypt; a browser
test on a user of its own.

- **Page** `/dashboard/settings` (behind the login like the rest of
  `/dashboard`), with a Settings link in the side navigation; a "Change
  password" section with three password fields (`autocomplete`
  current-password / new-password), each with its `aria-describedby` error
  region, and a live message.
- **Action** `changePassword` (Server Action): checks the session itself and
  takes the user from the session's email, never from the form; validates
  with `ChangePasswordForm` (zod): current password present; new one at least
  8 characters and at most 72 bytes (bcrypt ignores the rest), typed twice
  alike, and different from the current one. Then compares the current
  password with bcrypt and stores `bcryptjs.hash(new, 10)` — the cost the
  seed uses.
- **Limited like a login** (T17's `claimAttempt`): checking the current
  password is a guess at it, so a session holder could otherwise try passwords
  here without limit. Counted under its own key (`change-password:<email>`)
  since checkpoint 4: a shared count let an outsider's failed logins block a
  logged-in user's password change (and the reverse).
- **Not done**: other sessions of the user stay valid (JWT sessions cannot be
  revoked without a session store or a password-change timestamp checked on
  every request), and no email notice is sent. Q9.

## D28 — Checkpoint 4 (T16–T20)

- **Tests added**: the shape of migration 0004 (a new table keyed by email,
  nothing else touched), beside the checks for 0002 and 0003. Nothing
  removed: no test of removed behaviour, no duplicate found.
- **Reviewer finding 2 (Low), fixed**: change-password attempts are counted
  under their own key (D27); unit test asserts the key.
- **Finding 5 (Low), fixed**: `data.test.ts` rebuilds its schema in a
  file-level `beforeAll`, so each block also runs on its own.
- **Finding 1 (Medium), not changed in code — escalated in Q6.** The
  reviewer suggests making the database tests opt-in (`DATABASE_TESTS=1`, set
  only in CI). That would contradict the plan's words for T16 ("part of
  `npm test`, skipping without a database like the e2e ones"); the other fix
  is the skill's gate and §3, which are the human's to change. Q6 now gives
  both options.
- **Findings 3 and 4 (Low)**: already recorded as Q9 (sessions survive a
  password change) and Q7 (`login_failures` grows with made-up emails).

## D29 — T21: revenue from invoices (already true; proven, and the table's fate proposed)

Plan task 21: "The revenue chart reads the static `revenue` table. Compute it
from the invoices instead, so new invoices show in the chart. Do not drop the
table; propose that in `questions.md`."

- **Already done before this run.** The human's commit `c495f87` ("vibe a la
  vibe", 2026-10-01 09:41) removed `SELECT * FROM revenue`; the chart
  (`revenue-chart.tsx`) and the cards read `fetchMonthlyTotals` /
  `fetchCardData`, which sum the invoices. Nothing in `app/` reads the
  `revenue` table any more; only the seed fills it. The plan's description
  predates that commit.
- **What the task still needed**: evidence that new invoices show in the chart
  — a database test (CI) in `data.test.ts`: the block's own invoices appear in
  this month's and an earlier month's totals and in the 12-month cards, with
  exact sums (the seed is outside the window) — and the proposal (Q10). No
  application code changed.
