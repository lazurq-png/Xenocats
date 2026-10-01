# Progress — night-2026-10-01

## Run start

- Wall clock: 2026-10-01 14:45 (Thursday; time zone id `W. Europe Standard Time`)
- Goal: "Friday 08:30" → **Deadline: 2026-10-02 08:30**
- Session budget at start: 14,917,242 tokens (`<total_tokens>` at preflight).
  Reserve 10% (1.49M) while another session could follow; 30% (4.48M) once final.
- Limits, as written in the plan: "Information only. The run cannot see the
  account's usage limit; if it runs out, the session stops, and the per-task
  commit and push bound the loss."
- Started as `/loop 20m …` (cron job `f6484e94`, `*/20 * * * *`). That loop is
  the run's timer (§9.5); no other timer armed.

### Preflight

- Node v24.19.0, npm 11.17.0; `node_modules` present; Chromium present; `.env`
  present (existence only).
- Base: `main` at `06de26c`, up to date with `origin/main`. Tree clean: no
  pre-existing uncommitted changes.
- The plan is committed on `main` (`06de26c`).
- Run branch `night-2026-10-01` cut from `main` at `06de26c`.
- Remote `origin` (github.com/lazurq-png/Xenocats) reachable; no
  `night-2026-10-01*` branch on it.

### Baseline (2026-10-01 14:46–14:49)

- `npm run lint` → exit 0, **0 errors, 0 warnings** (`lint-baseline.txt`).
- `npx next typegen && npx tsc --noEmit` → exit 0.
- `npm test` → exit 0, 16 files, 231 tests (28 s).
- `npm run build` → exit 0 (29 s). **The build is in the gate.**
- `npm run test:e2e` → exit 0, 39 passed (60 s). Database reachable; the plain
  command is used.
- `next-env.d.ts` and `AGENTS.md` unchanged after the checks.

## T1 — Fight a cat: Survival (completed)

- Branch `night-2026-10-01-t1-survival`, base `06de26c`. Started 2026-10-01
  14:49 (budget 14.86M); completed 15:31.

**What the code does**

- `app/ui/xenocats/survival.ts` (new): the pure Survival game. Waves of cats
  arrive at random screen edges (≥ 240 px from the pointer, or the farthest
  spot on a small screen) and chase the pointer; each wave has one more cat,
  arrivals 12% sooner and cats 15% faster (with limits). A cat within 24 px
  lands its attack, leaves and costs one of 3 lives; a click within 36 px
  banishes the nearest cat. A wave is survived when all its cats have come and
  gone; score = waves survived; 0 lives ends it. Never more than the room it
  is given (5 minus cats already on screen). Also `bestScore`, the
  localStorage key, and a pausable game clock.
- `app/ui/xenocats/locked-pointer.ts` (new): the pointer under pointer lock.
  Moves by `movementX/Y`, clamped to the screen; an attack's effect (stepped by
  the existing cursor controller) moves the pointer itself, which stays where
  the effect left it.
- `app/ui/xenocats/fight.tsx` (new): the "Fight a cat" section on `/cats`.
  Start asks for pointer lock on `<body>`; granted → locked mode (the game
  draws its own pointer and decoys, clicks hit the locked pointer, blocked
  during an effect); refused/missing → fallback mode with the fake cursor.
  Full-screen overlay (`role="dialog"`) with lives, wave and score; cats are
  `aria-hidden`. Esc ends the game; losing the lock otherwise, blur or a
  hidden tab pauses it, Resume re-asks for the lock. Game over writes the best
  score to localStorage and announces it.
- `app/ui/xenocats/fake-cursor.tsx`: `hide()` / `isHidden()` on the cursor
  context (the fake cursor is hidden while the locked game draws its own);
  `placeCursor` and `CursorShape` exported for the game's pointer.
- `app/ui/xenocats/cat-layer.tsx`: `count()` on the cats context; gallery cats
  hold their attack while the cursor is hidden.
- `app/ui/xenocats/cat-gallery.tsx`: renders the Fight section above the
  roster; Summon buttons are disabled during a game; the roster's status line
  gets `data-testid="summon-status"`.
- Tests: `tests/unit/xenocats/survival.test.ts` (15), `locked-pointer.test.ts`
  (4), `tests/e2e/fight.spec.ts` (3, fallback path); `tests/e2e/cats.spec.ts`
  three locators narrowed to `summon-status` (D5).

**Why**: plan task 1. Interpretation of "the locked pointer itself" and the
derived acceptance criteria: D2. Esc vs. blur: D3. Five-cat limit with gallery
cats: D4.

**Acceptance criteria evidence**: 4, 5, 6, 7 (score), 10 by unit tests; 1, 5,
6, 7 (localStorage), 9 (fallback), 3 (Esc in fallback) by browser tests.
**Reading only**: 2 (locked mode), 3 under lock, 8 (pause on lock loss) —
Playwright cannot hold pointer lock reliably, so the locked path is unit-tested
in `locked-pointer.ts` but its wiring in `fight.tsx` was only read.

**Verification** (final, after the review fixes): `npm run lint` exit 0, 0
warnings (baseline 0); `next typegen && tsc --noEmit` exit 0; `npm test` exit
0, 18 files / 250 tests; `npm run build` exit 0; `npm run test:e2e` exit 0,
42 passed; prettier clean on every changed file (D1). The first full e2e run
failed `fight.spec.ts` "costs a life" once: two cats landed between polls
(lives 3 → 1); the test now asserts a loss rather than exactly one, then
passed 3/3 with `--repeat-each 3`.

**Review**: `reviewer` — Request Changes, 5 findings, all fixed: (1 Medium)
clicks were not blocked during an effect under lock → blocked; (2 Medium)
gallery cats summoned before Start kept attacking the hidden fake cursor,
swallowing the game's clicks, and drew above the overlay → they hold their
attack while the cursor is hidden, overlay raised to z-9998 (after the layer
in DOM order); (3 Low) double Start during the lock request → guarded; (4 Low)
lock granted after the 1 s timeout → released; (5 Low) no spawn on a small
screen → farthest spot fallback, with a unit test. The fixes were small and
local; no second review pass.

**UI**: tested in a browser (fallback path), not seen. A human should look at
the Fight overlay in both modes, especially under real pointer lock (Esc ends,
alt-tab pauses, the drawn pointer and its effects).

## T2 — Fight a cat: Taming (completed)

- Branch `night-2026-10-01-t2-taming`, base `481610b`. Started 2026-10-01
  15:07 (budget 14.79M); completed 16:06 (budget 14.71M).
- **Correction to T1's entry:** T1 completed at 15:05, not 15:31 as written
  there (misread clock).
- **T1 CI: passed** — `night-2026-10-01-t1-survival`
  https://github.com/lazurq-png/Xenocats/actions/runs/36866336836 and
  `night-2026-10-01` https://github.com/lazurq-png/Xenocats/actions/runs/36866340434.

**What the code does**

- `app/ui/xenocats/taming.ts` (new): the pure Taming game. One cat at a time
  wanders the screen; a pointer moving within 140 px makes it dodge in its
  type's way (`DODGES`, one entry per attack: blink, dash, sidestep, hop,
  circle, mirror, drop, axis, with distance, duration and reaction time); a
  pointer still for 1 s makes it walk over; holding still on it (within 36 px,
  moving < 6 px) for 2 s tames it, and the next cat comes after 1.2 s. No cat
  appears while other cats fill the 5-cat limit. Also the tamed collection
  (`{ typeId: count }` under `xenocats:tamed`) with a validating reader.
- `app/ui/xenocats/fight.tsx`: a "Start Taming" button beside "Start
  Survival", sharing pointer lock, fallback, pause and Esc. The overlay shows
  the tamed-this-game count and a hold progress bar; the cat glows as the hold
  fills and fades during a blink. Each tame is stored at once; the section
  shows the total tamed. The loop now moves cats directly and re-renders only
  on visible changes (D8).
- `tests/unit/xenocats/taming.test.ts` (new, 14 tests): all 20 types dodge
  differently; every dodge moves the cat on screen; kinds behave as named;
  moving near makes it dodge away; the lagging cat reacts late; 2-second rule
  (tamed at 2000–2050 ms after the hold starts, reset by a 10 px twitch, not
  tamed beside the cat); the next cat comes; room 0 → no cat; collection
  counting and validation.
- `tests/e2e/fight.spec.ts`: two Taming tests (fallback path): a still pointer
  draws the cat over and tames it into localStorage; a moving pointer makes it
  dodge.
- `tests/e2e/cats.spec.ts`: the `summon()` helper centres the button before
  measuring, so pointer moves stay on the page now the Fight section is taller
  (Mirror Sphynx test failed 5/5 without it — reviewer).

**Why**: plan task 2. Rules and acceptance criteria: D6.

**Acceptance criteria evidence**: (2) dodging, (3) 2-second rule, (5) own
dodges, (6) by unit tests; (1) Taming beside Survival with fallback, (3), (4)
localStorage collection by browser tests. Locked-mode Taming is covered by
reading only. "Each type dodges in its own way" is met by distinct parameters
over 8 kinds — several types share a kind (reviewer, Low; a judgement call for
the human, D6).

**Verification** (final code): `npm run lint` exit 0, 0 warnings (baseline
0); `next typegen && tsc --noEmit` exit 0; `npm test` exit 0, 19 files / 264
tests; `npm run build` exit 0; e2e `npx playwright test --workers=1` exit 0,
**44 passed** (5.1 min). The plain `npm run test:e2e` (4 workers) failed 3
timing-sensitive tests under machine load, as did a control run on the T1 tip
— D7. Prettier clean on all changed files (D1). `next-env.d.ts` restored after
the checks.

**Review**: `reviewer` — first pass Request Changes: (High) Mirror Sphynx e2e
failing → `summon()` centring; (Medium) Taming ignored gallery cats for the
5-cat limit → `room`; (Low) dodges differ by numbers within kinds → recorded.
Second pass after the fixes and D8: **Approve**.

**UI**: tested in a browser (fallback), not seen. A human should look at the
Taming overlay: the blink (drawn as a fast slide at 15% opacity, not a true
vanish), the hold glow and progress bar, and Taming under real pointer lock.

## T3 — Cats attack page elements too (completed)

- Branch `night-2026-10-01-t3-page-hits`, base `87faef3`. Started 2026-10-01
  16:07 (budget 14.70M); completed 17:02 (budget 14.63M).
- **T2 CI: passed** — `night-2026-10-01-t2-taming`
  https://github.com/lazurq-png/Xenocats/actions/runs/36873722004 and
  `night-2026-10-01` https://github.com/lazurq-png/Xenocats/actions/runs/36873731696.
- The machine load from T2 (D7) had gone: the plain `npm run test:e2e` passed
  in ~60 s again and is the gate's e2e step once more.

**What the code does**

- `app/ui/xenocats/page-hits.ts` (new): every attack's effect on the page.
  `PAGE_HITS` maps each of the 20 attacks to a page effect (blur, push away /
  toward / down / up / sideways, flip, shake, wobble, tilt, glow, scramble,
  swap). `selectTargets` picks controls, text, rows, cards and inputs within
  the radius, nearest first, never nested, skipping hidden (< 2 px), ignored
  (`aria-hidden`, `data-xenocat-ignore`) and anything containing a focused
  field. `applyHits` marks targets with `data-xenocat-hit*` attributes and
  `--xenocat-hit-*` properties and returns a restore that puts the `style`
  attribute back verbatim and removes the attributes. Scramble/swap draw text
  over the real text via `::after` with empty alt text.
- `app/ui/xenocats/fake-cursor.tsx`: `attack()` hits the page around the
  pointer when an attack starts; the page is restored on the first frame the
  clicks are no longer blocked, in the blocking listener itself if a click
  comes first, and on unmount.
- `app/ui/global.css`: the CSS for each hit kind, keyed on `data-xenocat-hit`.
- `app/ui/xenocats/config.ts`: `pageHitRadius` (120 px), `maxPageTargets` (6).
- `app/ui/dashboard/cards.tsx`, `cat-gallery.tsx`: cards marked
  `data-xenocat-card`; `fight.tsx`: the game overlay is `data-xenocat-ignore`.
- Tests: `tests/unit/xenocats/page-hits.test.ts` (new, 32: every attack has a
  page effect; selection by radius/order/max/nesting/size/ignore/focused
  field/rows; scrambling; exact restoration of the whole DOM and focus for
  every one of the 20 effects, with the real text unchanged throughout),
  `fake-cursor.test.tsx` (+2: hit on attack, restored exactly at the effect's
  end and on unmount), `tests/e2e/cats.spec.ts` (+2: Pulsar Siamese pushes the
  button under the pointer, which is byte-identical afterwards; Decoy Burmese
  scrambles card text for the eye only, the accessible heading stays, the
  card is byte-identical afterwards).

**Why**: plan task 3. Mechanism and derived criteria: D9.

**Acceptance criteria evidence**: (1) radius/config, (2), (3) exact restore,
(5) AT text, (6) focused field — unit tests; (3) and (5) also in the browser
for push and scramble; (4) clicks blocked while displaced — by construction
(same clock and check) and by reading; not tested by a click in the gap.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 20 files / 299 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 46 passed (59 s); prettier clean on every changed
file (D1). The scramble e2e test first failed: Chrome left `style=""` after
restoring text hits; traced to inline custom properties and fixed by moving
text hits to CSS only (D9).

**Review**: `reviewer` — Approve with 4 Low findings, all applied: one-frame
click gap before restore; the focused field could still be blurred/flipped;
`position: relative` pulled sr-only labels into the flow (now skipped as
< 2 px); rows never selected because cells won (now rows are the unit).

**UI**: tested in a browser (push, scramble), not seen. A human should look at
the 20 page effects on the dashboard, especially scrambled text over coloured
buttons and the swap.
