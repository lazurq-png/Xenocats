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

## T4 — Sound effects (completed)

- Branch `night-2026-10-01-t4-sounds`, base `fbf3daf`. Started 2026-10-01
  16:28 (budget 14.62M); completed 2026-10-01 16:38 (budget 14.59M).
- **Correction to T3's entry:** T3 completed at 16:27, not 17:02 as written
  there (written before reading the clock).
- **T3 CI: passed** — `night-2026-10-01-t3-page-hits`
  https://github.com/lazurq-png/Xenocats/actions/runs/36876486641 and
  `night-2026-10-01` https://github.com/lazurq-png/Xenocats/actions/runs/36876490694.

**What the code does**

- `app/ui/xenocats/sounds.ts` (new): every sound as a list of synthesised
  tones (oscillator or white noise, with glide and envelope); 20 distinct
  attack sounds keyed by effect id; per-cat-pitched wake and arrival sounds
  (`soundsFor`); the on/off choice in localStorage (`xenocats:sound`, on by
  default) with a subscribe/get pair for React; and the player, which makes the
  AudioContext only after a gesture, skips sounds while the context is still
  suspended, and swallows every Web Audio failure.
- `app/ui/xenocats/cat-layer.tsx`: the cats provider unlocks audio on the
  first gesture, plays a cat's arrival sound when it appears, its wake sound
  when it wakes and its attack sound when the attack is accepted; exposes
  `sound(typeId, which)`; renders the speaker toggle (bottom-right button,
  `aria-label="Cat sounds"`, `aria-pressed`, keyboard operable, immune to page
  hits).
- `app/ui/xenocats/fight.tsx`: game cats play their arrival sound when they
  appear; Survival plays the attack sound when a landed attack's effect runs.
- Tests: `tests/unit/xenocats/sounds.test.ts` (new, 9: every type has
  playable attack/wake/arrival sounds; attacks all differ; wake/arrival pitched
  per type; nothing before a gesture; plays every tone after; nothing on a
  suspended context; nothing when off; silent without or with failing Web
  Audio; the switch is on by default and remembers off).
  `tests/e2e/sound.spec.ts` (new, 3, Web Audio stubbed to count tones): the
  toggle is on by default, labelled, operated with Enter and Space, and
  remembered across a reload; a cat makes sound after the first click; with
  sound off the cats are silent.

**Why**: plan task 4. Design and derived criteria: D10.

**Acceptance criteria evidence**: (1), (2), (6), (7) unit tests; (3), (4)
toggle e2e; (5) unit (nothing before unlock) and e2e (sound after the first
click). Reading only: real audio output — nobody listened; touch-screen unlock.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 21 files / 308 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 49 passed (1.1 min); prettier clean (D1). The
first gate run failed the new "a cat sounds" e2e test once: it clicked before
hydration; the spec now waits for the fake cursor like the other specs, and
passed 9/9 with `--repeat-each 3`.

**Review**: `reviewer` — first pass Request Changes: (Medium) touch screens
never unlocked audio and suspended sounds piled up → gesture list and state
check; (Low) Survival sounded refused attacks → fixed; (Low) Fight cats had no
arrival sound → added; toggle could be hit by page effects → ignored. Second
pass: **Approve**, with N1 (first sound after the first gesture may be skipped,
accepted in D10) and N2 (D10 wording, fixed).

**UI**: tested in a browser with a stubbed AudioContext, not heard or seen. A
human should listen to the 20 attack sounds and look at the toggle's corner
position on the dashboard at phone width.

## T5 — Cat field guide (completed)

- Branch `night-2026-10-01-t5-field-guide`, base `77a719b`. Started
  2026-10-01 16:39 (budget 14.58M); completed 2026-10-01 16:59 (budget 14.53M).
- **T4 CI: passed** — `night-2026-10-01-t4-sounds`
  https://github.com/lazurq-png/Xenocats/actions/runs/36877975042 and
  `night-2026-10-01` https://github.com/lazurq-png/Xenocats/actions/runs/36877985017.

**What the code does**

- `app/ui/xenocats/field-guide.ts` (new): per-type stats in localStorage
  (`xenocats:guide`: times met, attacks survived) plus the tamed collection,
  with a validating parser, pure counters, and a store for
  `useSyncExternalStore` that notifies this tab on each write and other tabs
  via `storage`. `recordStat` / `recordTamed` ignore unknown types and never
  throw.
- `app/ui/xenocats/cat-layer.tsx`: a cat appearing counts as met; an accepted
  attack counts as survived.
- `app/ui/xenocats/fight.tsx`: Fight cats count as met when they first
  appear; a Survival landing that does not end the game counts as survived;
  tamed cats go through `recordTamed`, so the totals update at once.
- `app/ui/xenocats/cat-gallery.tsx`: a "Field guide" heading and summary
  above the roster ("You have met N of the 20 cats", or the empty-state
  explanation for a new visitor); each card shows Met / Attacks survived /
  Tamed or "Not met yet." in a fixed-height box. Cards are a memoised
  `CatCard`, so a count change re-renders one card.
- Tests: `tests/unit/xenocats/field-guide.test.ts` (new, 7),
  `tests/e2e/field-guide.spec.ts` (new, 3: empty guide for a new visitor;
  meeting a cat and surviving its attack is counted and kept after reload;
  stored counts incl. tamed are shown); `tests/e2e/cats.spec.ts` scramble test
  compares the card without its (rightly changing) guide entry and checks the
  entry carries no leftover effect attributes.

**Why**: plan task 5. Definitions: D11.

**Acceptance criteria evidence**: stats per type (met, survived, tamed) and
the empty state — unit and browser tests. Narrow-window layout — not checked.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 22 files / 315 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 52 passed (1.3 min); after the final one-line test
addition `cats.spec.ts` 28 passed, lint and tsc clean; prettier clean (D1).
The first full run failed 3 existing `/cats` tests: meeting a cat changed the
card's height (and the summary's), moving buttons under a still pointer, and
the scramble test compared the card's text including its new counts. Fixed by
fixed-height entries, a reserved summary height, memoised cards, and comparing
the card without its guide entry.

**Review**: `reviewer` — Approve (Low: summary said "met 0" to a visitor who
had only tamed cats → met now includes tamed). Re-review after the layout and
test changes: Approve, with an optional extra assertion (added). Note from the
reviewer: in a narrow window the empty-state summary wraps to more than the
reserved 3 lines, so the roster moves once when the first cat is met.

**UI**: tested in a browser, not seen. A human should look at the cards' count
boxes (11 px labels) and the summary at phone width.

## Checkpoint 1 (after T5; range `06de26c..e8f8d23`) (completed)

- Branch `night-2026-10-01-c1-checkpoint`, base `e8f8d23`. Started
  2026-10-01 16:59 (budget 14.53M); completed 2026-10-01 17:15 (budget 14.49M).
- **T5 CI: passed** — `night-2026-10-01-t5-field-guide`
  https://github.com/lazurq-png/Xenocats/actions/runs/36880753894 and
  `night-2026-10-01` https://github.com/lazurq-png/Xenocats/actions/runs/36880762566.

**1. Tests.** Every behaviour of T1–T5 was checked for a test that would fail
without it. Gaps found and filled:
- The pointer-lock path (T1/T2), until now covered only by reading: headless
  Chromium grants the lock, so `fight.spec.ts` now plays Survival under real
  pointer lock — lock on `<body>`, fake cursor hidden, the game's pointer
  moving by exactly the mouse movement, a click banishing the cat under the
  locked pointer, and losing the lock while focused ending the game.
- Pause and resume (T1 criterion 8): blur pauses, cats stay exactly put,
  Resume carries on.
- No test of removed behaviour, no duplicate, no test that cannot fail was
  found; nothing deleted. One flake seen once: the Taming dodge test (D12).

**2. Quality and security.** `reviewer` on the whole range with
`.claude/rules/security-review.md`: **no security findings** (no server, SQL,
auth or dependency change; every localStorage read validated; nothing reaches
the DOM as HTML). Four findings, all handled:
- (Medium) one AudioContext per provider mount, never closed → one shared
  player per page, no context while sound is off; unit tests.
- (Low) the lock-lost timer and pending lock requests could act after unmount
  → timer cleared, `mountedRef` guard releases a late lock.
- (Low) the game's `aria-modal` dialog did not contain Tab → Tab/Shift+Tab
  wrap inside it; e2e.
- (Low) Fight attacks under lock do not hit page elements → recorded (D12).
Re-check of the fixes: **Approve**, no new findings.

**3. Verification**: `npm run lint` exit 0, 0 warnings; `next typegen &&
tsc` exit 0; `npm test` exit 0, 22 files / 317 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 54 passed (1.3 min); prettier clean (D1);
`fight.spec.ts` 28/28 with `--repeat-each 4`.

## Checkpoint 1 — CI (appended after the checkpoint's own entry)

- `c4df896` (checkpoint 1): **CI failed** — both browser-test jobs; checks
  job passed. Runs 36882816905 / 36882811268.
- Fix cycle 1, `53251eb` (lock test skips when the lock is refused): **CI
  failed**, same jobs. Runs 36885127092 / 36885123305.
- Fix cycle 2, `fdbc6cd` (named per-spec browser groups with separate
  reports; all unit tests now in CI groups, five older ones included, plus a
  guard; Taming dodge-test flake fixed): **CI failed, only the fight group**,
  in both jobs. Runs 36904288443 / 36904284951.
- Fix cycle 3, `6a30700` (lock test checks pause vs. game over by the
  browser's focus): **CI failed**, fight group only. Runs 36906133949 /
  36906128598.
- Three cycles reached: the checkpoint's branches stay pushed as they are;
  the hypotheses and evidence are in D12 and Q1. Every check passes locally,
  also with CI's settings, on both servers. The run's three-cycle limit has
  been used once; a second task reaching it ends the run.
- **Gap:** no activity between about 17:45 and 19:49 (session paused,
  probably a usage limit); work resumed on the timer's next firing.

## T6 — Pet a sleeping cat (completed)

- Branch `night-2026-10-01-t6-pet-cat`, base `c4df896`, rebased by
  fast-forward onto `6a30700` while the checkpoint's CI was being fixed (the
  task's work was parked in a stash meanwhile). Started 2026-10-01 17:16
  (budget 14.49M); completed 2026-10-01 20:32 (budget 14.35M).

**What the code does**

- `app/ui/xenocats/cat-engine.ts`: petting — the pointer resting on a
  sleeping cat for 1 s (`petMs`) purrs and keeps it asleep at least 4 s
  (`petSleepMs`) after the last purr; `poke` — a click on a sleeping cat
  wakes it at once and marks it angry.
- `app/ui/xenocats/effects.ts`: `strengthen(effect, factor)` — the effect
  lasts `factor` times as long (within the 10 s cap), blurs and scales more,
  and, for effects marked `amplify: 'offset'` (knockback, drift, jitter,
  drunk, decoys, teleport, fall), throws the cursor that much further; the
  wrapped effect still sees its own previous look, so nothing compounds.
- `app/ui/xenocats/cat-layer.tsx`: purrs with the cat's purr sound; an angry
  cat attacks with its effect strengthened by `angryFactor` (1.5) and glows
  red; clicks poke at the visible cursor (a tap where it touched), not while
  an effect blocks clicks; petting only while the pointer is on the page.
- `app/ui/xenocats/config.ts`, `sounds.ts`, `global.css`: the three settings,
  a per-cat-pitched purr, the angry glow.
- Tests: `tests/unit/xenocats/pet-cat.test.ts` (new, 12), `sounds.test.ts`
  (purr), `tests/e2e/pet-cat.spec.ts` (new, 2: petting purrs and keeps the
  cat asleep past its longest nap; a click wakes it angry and its vanish lasts
  1.5× as long). Both added to CI's groups (`.github/workflows/ci.yml`).

**Why**: plan task 6. Design: D13.

**Acceptance criteria evidence**: hover 1 s → purr and later waking; click →
early, angry wake; stronger attack by a config amount — unit and browser
tests. Nobody heard the purr.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 23 files / 329 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 56 passed (on base `fdbc6cd`); after the move to
`6a30700` (a one-test change) lint, tsc, `npm test` (329) and the fight and
pet-cat specs (9 passed) again; actionlint clean with the CI group change.
The first gate failed the angry-click e2e test: the click on the cat also
pressed a Summon button under it (D13: clicks pass through), whose cat's
attack followed — the test now checks that the vanish ended.

**Review**: `reviewer` — Request Changes: (Medium) `strengthen` scaled every
effect's distance from the real pointer, turning freeze, heavy, orbit, spiral,
bounce, axis-lock and magnet into different effects, hidden by a test that
held the real pointer still → only offset effects are amplified, tests move
the pointer; (Low) petting while the pointer was off the page → gated; (Low)
clicks poked at the real pointer, not the visible cursor → fixed. Re-review:
**Approve**, two Lows applied (tap coordinates; D13 wording).

**CI**: will inherit the fight-group failure (Q1).

## T7 — Cat combos (completed)

- Branch `night-2026-10-01-t7-combos`, base `5778966`. Started 2026-10-01
  20:33 (budget 14.35M); completed 2026-10-01 20:48 (budget 14.30M).
- **T6 CI: failed, fight group only** (inherited, Q1); every other group,
  including the new petting tests, passed. Runs 36907665487 / 36907658666.

**What the code does**

- `app/ui/xenocats/combos.ts` (new): three pure combinators (`layer`,
  `chain`, `restyle`) and six combos: Ice puck (freeze + bounce), Slingshot
  (knockback + magnet), Hangover (reverse + drunk), Ghost jump (vanish +
  teleport), Pulsar (tiny + giant), Static fog (jitter + blur); `findCombo`.
- `app/ui/xenocats/cat-engine.ts`: a cat starting to wake (naturally or
  poked) pairs with another that started within 1.5 s and 220 px
  (`comboWindowMs`, `comboDistance`) when their attacks combine, and only if
  no pair is pending or attacking; a paired cat waits for its partner, then
  both attack once, from between them, with the combo; pairs dissolve as they
  leave.
- `app/ui/xenocats/cat-layer.tsx`: a combo attack uses the combo's effect
  (strengthened if either cat is angry), plays both attack sounds and counts
  as survived for both types; paired cats carry `data-combo`.
- `app/ui/xenocats/page-hits.ts`: a page effect for each combo.
- `config.ts`: the two combo settings. `ci.yml`: the new unit test file in
  its group.
- Tests: `tests/unit/xenocats/combos.test.ts` (new, 16): five or more combos
  from real attacks; found in either order; each hits the page; amplify only
  where the parts do; one behaviour test per combo; pairing by pokes and by
  natural waking; not when too late, too far or without a combo; one combo at
  a time. Two e2e fixes: `pet-cat.spec.ts` takes the first Void Tabby (the
  click can summon a second through the button under the cat);
  `fight.spec.ts` "banishing every cat of a wave" starts a new game when one
  ends before wave 2 (see Q1).

**Why**: plan task 7. Design: D14.

**Acceptance criteria evidence**: proximity in place and time from config,
fusion into one effect, one combo at a time counting as the one effect, six
combos each unit-tested — all by unit tests. No browser test (two cats' wake
times cannot be steered from a browser); nobody has seen a combo.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 24 files / 351 tests; `npm run build` exit 0;
`npm run test:e2e` 55 passed, 1 failed (the wave test above), then after its
fix `fight.spec.ts` 42/42 (`--repeat-each 3`, twice) and `pet-cat.spec.ts`
6/6; actionlint clean; prettier clean (D1).

**Review**: `reviewer` — Request Changes: (Medium) combos had no page effect
→ added, tested; (Low) angry combos lost the offset amplification → carried;
(Low) natural-waking pairing untested → tested; the layer's combo wiring is
covered by reading only. The pairing state machine itself was found correct.

## T8 — Cats on touch devices (completed)

- Branch `night-2026-10-01-t8-touch`, base `c697632`. Started 2026-10-01
  20:48 (budget 14.30M); completed 2026-10-01 21:02 (budget 14.27M).
- **T7 CI: failed, fight group only** (inherited, Q1 — the hardened wave test
  did not clear it). Runs 36909573185 / 36909567056.

**What the code does**

- `app/ui/xenocats/fake-cursor.tsx`: with no precise pointer (the fake cursor
  stays off), the provider remembers the last touch (non-mouse
  `pointerdown`); `attack()` then hits the page elements around that point
  for the effect's duration, restored by a timer, the next tap past the end,
  or unmount; taps (`mousedown`, `click`, `dblclick`, `contextmenu` with
  `detail > 0`) are blocked meanwhile, keyboard clicks never; nothing that
  starts a scroll is touched. A touch with nothing in reach hits nothing and
  blocks nothing. `touchPoint()` and a touch-aware `isBusy()` on the context.
- `app/ui/xenocats/cat-layer.tsx`: a cat with no fake cursor attacks at the
  touch point; with neither, it pounces at nothing and leaves, as before.
- Tests: `fake-cursor.test.tsx` (+3: no fake cursor; nothing before a
  touch; a hit around the touch, one at a time, taps blocked and keyboard
  clicks not, restored exactly; nothing hit far from everything; restored on
  unmount). `tests/e2e/touch.spec.ts` (new, Pixel 7 profile): no fake cursor,
  the system cursor not hidden, the touched button pushed by Pulsar Siamese's
  attack, a tap during it does not summon, the button byte-identical
  afterwards and the same tap working again. In CI's cats group.

**Why**: plan task 8. Design: D15.

**Acceptance criteria evidence**: all four (appear, attack page elements only,
centred on the last touch, fake cursor off) by the touch-profile browser test
and unit tests. Not checked on a real phone.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 24 files / 354 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 57 passed; actionlint clean; prettier clean (D1).

**Review**: `reviewer` — Request Changes: (Medium) the e2e "tap blocked"
check could not fail → status-message check plus a positive control; (Medium)
a touch hitting nothing still froze taps for seconds → no block then, unit
test; (Low) a device switching from mouse to touch could strand cats → the
touch path keys on the touch point; (Low) a tap could focus a displaced field
→ `mousedown` blocked. All applied; no second review pass (each fix is local
and tested).

## T9 — Foreign keys and indexes (completed)

- Branch `night-2026-10-01-t9-keys-indexes`, base `fab97df`. Started
  2026-10-01 21:02 (budget 14.27M); completed 2026-10-01 21:10 (budget 14.24M).
- **T8 CI: failed, fight group only** (inherited, Q1); the new touch test
  passed in CI. Runs 36911310720 / 36911305669.

**What the code does**

- `db/migrations/0002_invoice_keys_and_indexes.sql` (new): `invoices.customer_id`
  references `customers(id)` `ON DELETE RESTRICT`; indexes on
  `invoices(customer_id)`, `invoices(date DESC)` and `invoices(status, date
  DESC)`. Adds only; on a database with an orphan invoice it fails and
  changes nothing; it briefly blocks writes while it runs.
- `tests/unit/seed-data.test.ts` (new, 4): every seeded invoice names a seeded
  customer, customer ids are unique, migrations are numbered without gaps,
  0002 adds the key and drops nothing. In CI's dashboard unit group.
- `tests/e2e/cats.spec.ts`: the stomp-shake test (failed under load in T5,
  T6 and T9's first gate: 40.9 px against a 40 px tolerance) now compares
  what a scroll jump would move — the cat layer's box and the cat's layout
  position — exactly, instead of the cat's drawn box (which its own arrival
  animation moves) within a tolerance.

**Why**: plan task 9. Design and the unindexed substring search: D16, Q2.
Applying it to `xenocats` is a human's step: Q3.

**Acceptance criteria evidence**: the key and indexes apply, and the seed
satisfies the key, in a real PostgreSQL (the e2e global setup logged "applied
0002_invoice_keys_and_indexes.sql" then "seeded schema"); unit tests for the
seed. The key's effect on a customer delete is exercised by task 10.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 25 files / 358 tests; `npm run build` exit 0;
`npm run test:e2e` 56 passed, 1 failed (the stomp-shake flake), then the
rewritten test 6/6 and `cats.spec.ts` 28/28; actionlint clean.

**Review**: `reviewer` — Approve; two Low wording corrections applied (Q2's
trigram advice would only help the customers search; the migration's write
locks are now stated).

## T10 — Customer CRUD (completed)

- Branch `night-2026-10-01-t10-customer-crud`, base `e61493b`. Started
  2026-10-01 21:10 (budget 14.24M); completed 2026-10-01 21:29 (budget 14.18M).
- **T9 CI: failed, fight group only** (inherited, Q1); its `db:migrate &&
  db:seed` step passed on CI's fresh PostgreSQL. Runs 36912348456 /
  36912343934.

**What the code does**

- `app/lib/actions.ts`: `createCustomer`, `updateCustomer`, `deleteCustomer`
  — each checks the session, validates name/email (`CustomerForm`) and the
  id (`CustomerId`, a UUID), writes with parameterised SQL, returns only
  generic database errors; a delete refused by the invoices' foreign key
  (`23503`) returns "This customer still has invoices. Delete or reassign
  them first."; every write revalidates the customer list, the invoice list
  and the invoice form.
- `app/lib/schemas.ts`, `data.ts`, `definitions.ts`: the two schemas,
  `fetchCustomerById`, `CustomerEdit`.
- `app/dashboard/customers/page.tsx`: the real customers page (was a
  placeholder): heading, search, Create Customer, the table. `create/page.tsx`,
  `[id]/edit/page.tsx` (not-found for unknown or malformed ids),
  `[id]/edit/not-found.tsx`, `error.tsx`.
- `app/ui/customers/customer-form.tsx` (one form for create and edit, errors
  per field with `aria-describedby`), `buttons.tsx` (create/edit links; a
  delete form whose refusal message is shown and tied to the button),
  `table.tsx` (edit and delete per row, phone and desktop; empty state).
- `app/dashboard/invoices/create/page.tsx`: rendered per request, so its
  customer list is never the build-time one.
- Tests: `tests/unit/schemas.test.ts` (+6), `tests/e2e/customers.spec.ts` (new,
  4, each on its own customer: create/edit/delete; per-field errors with
  `aria-describedby`; delete refused while invoiced, message tied to the
  button, customer kept; not-found); `dashboard.spec.ts` searches for its seed
  row. In CI's first browser group.

**Why**: plan task 10. Design: D17.

**Acceptance criteria evidence**: all by browser tests against both
`next dev` and `next start`, plus schema unit tests; the auth check in each
action by reading (no test calls the actions unauthenticated).

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 25 files / 364 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 61 passed; `E2E_SERVER=start npm run test:e2e` over
a fresh build exit 0, 61 passed; actionlint clean; prettier clean (D1).

**Review**: `reviewer` (security, backend and frontend rules in scope) —
Request Changes: (High) the invoice form was prerendered at build time, so new
customers could not be invoiced under `next start` → dynamic page,
revalidation, verified on `next start`; (Medium) a new invoice could push the
dashboard test's seed row to page 2 → the test searches; (Low) no error page
→ added. Authentication, validation, SQL, error leakage, the 23503 mapping,
redirect placement and accessibility were checked and found correct.

**UI**: tested in a browser, not seen. A human should look at the customers
page and forms at phone and desktop width, and the delete message's placement.

## Checkpoint 2 (after T10; range `6a30700..be47583`, tasks 6–10) (completed)

- Branch `night-2026-10-01-c2-checkpoint`, base `be47583`. Started
  2026-10-01 21:29 (budget 14.18M); completed 2026-10-01 21:39 (budget 14.15M).
- **T10 CI: failed, fight group only** (inherited, Q1); the new customer tests
  passed in CI against both servers. Runs 36914655151 / 36914651125.

**1. Tests.** Gaps found and filled: the customer Server Actions had no unit
tests (refusal without a session, before validation; malformed ids never
reaching SQL; trimmed inserts; revalidated views; the foreign-key and
self-guard messages; generic errors that leak nothing); the combo wiring in
the page layer had none (two cats waking together attack once, with the
combo's effect). No test removed or found irrelevant.

**2. Quality and security.** `reviewer` on the range with the security,
backend and database rules: authentication, validation, SQL, error leakage,
caching, the migration and the plan-wide cat rules all sound. Two findings,
both fixed:
- (Medium, cross-task T6 + T10) poking a sleeping cat also clicked what lay
  beneath — on the customers page, possibly an instant Delete → a press that
  pokes a cat is swallowed through its click (keyboard clicks never), D18;
  unit test, and the pet-cat browser test checks nothing beneath was clicked.
- (Low) the customer delete relied only on the foreign key, which the
  `xenocats` schema lacks until a human migrates (Q3) → the delete refuses a
  customer with invoices itself.

**3. Verification**: `npm run lint` exit 0, 0 warnings; `next typegen &&
tsc` exit 0; `npm test` exit 0, 25 files / 375 tests; `npm run build` exit
0; `npm run test:e2e` exit 0, 61 passed; `E2E_SERVER=start npm run test:e2e`
exit 0, 61 passed; prettier clean (D1).

## T11 — Invoice status filter (completed)

- Branch `night-2026-10-01-t11-status-filter`, base `623d402`. Started
  2026-10-01 21:39 (budget 14.15M); completed 2026-10-01 21:50 (budget 14.12M).
- **Checkpoint 2 CI: failed, fight group only** (inherited, Q1). Runs
  36915871842 / 36915867669.

**What the code does**

- `app/lib/schemas.ts`: `InvoiceStatusFilter` (paid, pending) and
  `parseStatusFilter`, which drops anything else.
- `app/lib/data.ts`: `fetchFilteredInvoices` and `fetchInvoicesPages` take
  an optional status; the search's `OR`s are parenthesised and `AND (status
  IS NULL OR invoices.status = status)` added, as a parameter.
- `app/ui/invoices/status-filter.tsx` (new): a labelled select ("Status": All
  statuses / Paid / Pending) beside the search; it writes `?status=` like the
  search writes `?query=`, and goes back to page 1.
- `app/dashboard/invoices/page.tsx`, `app/ui/invoices/table.tsx`: read and
  pass the status; the Suspense key includes it. Pagination already keeps
  every URL parameter.
- Tests: `parseStatusFilter` unit test; `tests/e2e/invoices-filter.spec.ts`
  (new, 2): the filter in the URL; page 2 keeps it and shows other paid
  invoices; with a search for a customer who has both statuses, each filter
  shows only that customer's invoices of that status; an unknown status shows
  everything. In CI's first browser group.

**Why**: plan task 11. Design: D19.

**Acceptance criteria evidence**: all four (URL, beside search, through
pagination, combined with search) by the browser test on both servers.

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0, 25 files / 376 tests; `npm run build` exit 0;
`npm run test:e2e` exit 0, 63 passed, and `E2E_SERVER=start` 63 passed;
after the test fix, the spec 6/6 (dev) and 4/4 (start); actionlint clean;
prettier clean (D1).

**Review**: `reviewer` — product code correct (SQL precedence, parameters,
NULL handling, URL handling, accessibility); Request Changes on the test:
(Medium) the "combined with search" step used a customer whose invoices are
all paid, so it could not fail → a customer with both statuses, both filters
checked; (Low) page 2 might show page 1's rows → asserted different. Fixed.

**UI**: tested in a browser, not seen. At phone width the search, the select
and Create share one row; a human should look.

## T12 — Invoice detail and delete confirmation (completed)

- Branch `night-2026-10-01-t12-invoice-detail`, base `51a5f13`. Started
  2026-10-01 21:50 (budget 14.12M); completed 2026-10-02 01:02 (budget 14.07M).
- **Gap:** no activity between about 21:55 and 00:49 (session paused,
  probably a usage limit); resumed on the timer's next firing.
- **T11 CI: failed, fight group only** (inherited, Q1). Runs 36917216110 /
  36917209430.

**What the code does**

- `app/dashboard/invoices/[id]/page.tsx` (new) and `not-found.tsx`: the
  invoice with its customer (name, avatar, email), status, amount, date and
  number, with Edit and Delete; unknown or malformed ids are not found.
- `app/ui/invoices/delete-invoice.tsx` (new): the trash button opens a native
  modal `<dialog>` ("Delete this invoice?"): page inert behind it, Cancel
  focused first, Tab and Shift+Tab wrapped, Esc cancels, focus back on the
  trash button; confirming deletes (and from the detail page goes to the
  list; from the list, focus moves to the search box); while deleting, it
  cannot be dismissed, so a failure is shown in it.
- `app/ui/invoices/buttons.tsx`, `table.tsx`: a View link per row; Delete
  named for its invoice ("Delete invoice for Amy Burns, $12,345.67").
- `app/lib/actions.ts`: `deleteInvoice` validates the id as a UUID before any
  SQL; `deleteInvoiceAndReturn`; **bug fix** — invoice amounts are stored as
  `Math.round(amount * 100)` (`amount * 100` failed to insert for about 15 % of
  amounts, and the form reset silently; found by the new browser tests).
- `schemas.ts` (`InvoiceId`), `data.ts` (`fetchInvoiceDetail`),
  `definitions.ts` (`InvoiceDetail`).
- Tests: unit (`InvoiceId`; `deleteInvoice` refuses a malformed id; the
  redirecting delete; whole-number cents, failing without the fix);
  `tests/e2e/invoice-detail.spec.ts` (new, 4, each on its own invoice: detail
  reached from the list; the dialog — focus first on Cancel, Tab wraps both
  ways, Esc cancels and restores focus, Cancel likewise, confirm deletes and
  focus lands on search; delete from the detail page returns to the list;
  not-found). In CI's first browser group.

**Why**: plan task 12. Design: D20.

**Acceptance criteria evidence**: detail page, dialog, focus trapped and
restored, Esc cancels — all by the browser test on both servers. The
failure message in the dialog is untested (reading only).

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `npm test` exit 0; `npm run build` exit 0; `npm run test:e2e` 67
passed and `E2E_SERVER=start` 67 passed; the new spec 20/20 over five
repeats; after the review fixes the spec 12/12 (dev) and 8/8 (start, fresh
build); actionlint clean; prettier clean (D1).

**Review**: `reviewer` — Approve; three Lows (404 flash after deleting from
the detail page; focus lost after a list delete; Esc during a delete could
hide its failure), all fixed.

**UI**: tested in a browser, not seen. A human should look at the dialog and
the detail page at phone and desktop width.

## T13 — CSV export of the invoice list (completed)

- Branch `night-2026-10-01-t13-csv-export`, base `4b4f512`. Started
  2026-10-02 01:02 (budget 14.07M); completed 2026-10-02 01:17 (budget 13.93M).
- **T12 CI: failed, fight group only** (inherited, Q1); the invoice-detail
  browser group passed. Runs 36938570356 / 36938567786.

**What the code does**

- `app/dashboard/invoices/export/route.ts` (new): `GET` answers 401 without a
  session before reading anything; otherwise the invoices matching the list's
  search and status filter, newest first, as a CSV attachment
  (`invoices.csv`, `text/csv; charset=utf-8`, `no-store`, UTF-8 byte-order
  mark). Columns Date, Customer, Email, Amount (dollars), Status. More than
  10 000 matching invoices is refused with 422 and "narrow the search or the
  status filter", never a file cut short.
- `app/lib/csv.ts` (new): cells safe for spreadsheets — text a spreadsheet
  could run as a formula (`= + - @`, full-width forms, after leading spaces or
  control characters, or a leading tab/CR/LF) gets an apostrophe; RFC 4180
  quoting.
- `app/lib/data.ts`: `fetchInvoicesForExport` (the list's WHERE, no
  pagination, `EXPORT_LIMIT + 1` rows).
- `app/ui/invoices/export-invoices.tsx` (new) and the invoices page: an
  "Export CSV" link beside the status filter carrying the current search and
  status.
- Tests: `tests/unit/csv.test.ts`, `tests/unit/export-route.test.ts` (401,
  headers, BOM bytes, rows, formula defused, 422 over the cap, unknown
  status ignored); `tests/e2e/invoice-export.spec.ts` (makes a customer named
  like a formula and an invoice, downloads the filtered export and checks its
  one row; a signed-out request gets no CSV). CI groups updated.

**Why**: plan task 13. Design: D21.

**Acceptance criteria evidence**: button downloads the filtered list, behind
the login, formulas defused — browser test on both servers plus unit tests.
The 422 path is unit-tested only (10 001 rows were not created in a browser).

**Verification**: `npm run lint` exit 0, 0 warnings (baseline 0);
`next typegen && tsc` exit 0; `npm test` 27 files / 394 tests, exit 0;
`npm run build` exit 0; `npm run test:e2e` 69 passed and
`E2E_SERVER=start` 69 passed; actionlint clean; prettier clean (D1).

**Review**: `reviewer` — first pass: three Lows (formula detection missed
leading whitespace/LF/full-width; silent truncation at the cap; the
`download` attribute would save a login page as a file after the session
expired) plus a note on an export-only 200-character query cap. All fixed
(D21). Re-review: Approve; one Low (D21 out of date), fixed.

**UI**: tested in a browser, not seen. A human should look at the Export CSV
button beside the filter at phone and desktop width, and open the file in a
spreadsheet.

## T14 — Invoice due dates and overdue (completed)

- Branch `night-2026-10-01-t14-due-dates`, base `ff07941`. Started
  2026-10-02 01:17 (budget 13.93M); completed 2026-10-02 01:50 (budget 13.87M).
- **T13**: committed `ff07941`, merged and pushed. CI: **pushed; CI not observed** — the poll found no workflow run for `ff07941` on either branch within its 30 minutes (both branches confirmed at `ff07941` on the remote).

**What the code does**

- `db/migrations/0003_invoice_due_dates.sql` (new): adds `invoices.due_date`,
  fills existing rows with their date + 30 days, then makes it required
  (default today + 30, check `due_date >= date`). Not applied to `xenocats`
  (Q3).
- `app/lib/data.ts`: overdue is worked out when read (pending and past its
  due date), never stored; one status filter (`matchesStatus`) for the list,
  its page count and the export, where paid, pending (not yet due) and
  overdue are disjoint. The list, latest invoices, detail and export queries
  return `overdue`; detail and export also the due date.
- `app/lib/actions.ts`: a new invoice is due 30 days after its date.
- `app/ui/invoices/status.tsx`: an unpaid invoice past its due date shows
  "Overdue" (filled lime pill) instead of "Pending"; used by the invoice
  table, the dashboard's latest invoices and the detail page, which also
  shows the due date.
- `app/ui/invoices/status-filter.tsx`, `app/lib/schemas.ts`: an Overdue
  filter option (`?status=overdue`).
- Export route: a Due column; Status says `overdue` as the list does.
- Seed (`placeholder-data.ts`, `scripts/db.mjs`): every invoice has a due
  date, its date + 30.
- Tests: unit (the filter accepts `overdue`; `createInvoice` inserts the due
  date as date + 30; export rows for pending, overdue and paid); browser
  (`invoices-filter.spec.ts`: Overdue filter on seeded rows; a new invoice of
  its own is Pending, under the pending filter and not under overdue, and
  its detail page shows the due date 30 days ahead; export spec's Due
  column).

**Why**: plan task 14. Design: D22; editable terms proposed as Q4.

**Acceptance criteria evidence**: migration applied from scratch by the e2e
setup on every run (both servers), CI will apply it too; derived due dates for
existing rows — by reading (the seed inserts its own due dates, so no test
runs the `UPDATE` on existing rows); overdue shown and filterable — browser
test on seeded rows; pending vs. overdue for a new invoice — browser test.

**Verification**: `npm run lint` exit 0, 0 warnings (baseline 0);
`next typegen && tsc` exit 0; `npm test` 27 files / 394 tests, exit 0;
`npm run build` exit 0; `npm run test:e2e` 70 passed and
`E2E_SERVER=start` 70 passed; prettier clean on the changed files (D1).

**Review**: `reviewer` — Approve; two optional Lows, not taken, reasons in
D22: every seeded unpaid invoice is overdue (a made-up future due date would
be fake demo data); the text search matches the stored status, not the word
"overdue" (the filter does).

**UI**: tested in a browser, not seen. A human should look at the Overdue
pill in the invoice table, the dashboard's latest invoices and the detail
page (with its Due line), at phone and desktop width.

## T15 — Browser tests for invoice create, edit and delete (completed)

- Branch `night-2026-10-01-t15-invoice-crud-e2e`, base `6e5f60d`. Started
  2026-10-02 01:50 (budget 13.86M); completed 2026-10-02 02:33 (budget 13.83M).
- **T14**: committed `6e5f60d`, merged and pushed. CI: **failed, fight group only** (inherited, Q1); every other step passed, including the production job's migrate-and-seed, so CI applied `0003` from scratch. Runs 36942947776 / 36942947674.
- **Correction to the T14 entry:** T13's CI was not "not observed". The poll was given a short SHA, and the API's `head_sha` filter needs the full one, so it found no runs (same for T14's first poll). Re-polled with the full SHAs: T13 **failed, fight group only** (inherited, Q1), runs 36940057306 / 36940057463.

**What the code does**

- `tests/e2e/invoices.spec.ts` (new, 4 tests, each on its own invoice with a
  unique 7-digit amount in cents, so a search finds only it):
  - an incomplete create form: empty, each field's error in its
    `aria-describedby` region; then valid but for the status, refused for
    that alone, and no invoice with its amount exists afterwards;
  - create: a zero amount is refused (only the amount error), then the
    invoice is created and listed for Amy Burns as Pending;
  - edit: the form opens prefilled with this invoice's amount; a negative
    amount is refused; a new amount and Paid are saved — one row at the new
    amount, Paid, none at the old;
  - delete: through the list's confirmation dialog; gone, also after a
    fresh load of the list.
- `.github/workflows/ci.yml`: the spec in the first browser group of both
  browser jobs.

**Why**: plan task 15. No production code changed, so no decision record.

**Verification**: `npm run lint` exit 0, 0 warnings (baseline 0);
`next typegen && tsc` exit 0; `npm test` 27 files / 394 tests, exit 0;
`npm run build` exit 0; `npm run test:e2e` 74 passed and
`E2E_SERVER=start` 74 passed; the new spec 12/12 over three repeats before
the review, and after the review fix 8/8 (dev, two repeats) and 4/4
(start); actionlint clean; prettier clean (D1).

**Review**: `reviewer` — Approve; two Lows. (1) Two "nothing is created"
checks could not fail (one asserted nothing, one searched for an amount
never submitted): fixed — the incomplete-form test now submits a unique
amount and checks no such invoice exists; the vacuous line is gone. (2) The
delete test overlaps `invoice-detail.spec.ts`: kept, because the task asks
for delete explicitly and this one adds the check after a fresh load.

## Checkpoint 3 (after T15; range `623d402..9ea0277`, tasks 11–15) (completed)

- Branch `night-2026-10-01-c3-checkpoint`, base `9ea0277`. Started
  2026-10-02 02:33 (budget 13.83M); completed 2026-10-02 02:46 (budget 13.79M).
- **T15 CI: failed, fight group only** (inherited, Q1); the new invoice CRUD
  tests passed in CI against both servers. Runs 36946614975 / 36946614688.

**1. Tests.** Gaps found and filled (D23):
- the seed's due dates are checked against the database's rule;
- migration 0003's shape is checked (add, fill, then require; drops nothing);
- a unit test for the status pill: Overdue only for unpaid invoices, never
  over Paid;
- a browser check that the pending filter leaves out overdue invoices.

Still untested: the migration's backfill on a table that already holds rows.
That belongs to T16's database tests. No test was removed.

**2. Quality and security.** `reviewer` covered the range with the security,
backend and database rules. It found no security issue in authentication,
the new action, the export route, SQL, CSV escaping, error leakage, money or
the migration. Its three cross-task findings:
- **(Medium) Fixed.** T15's edit test marks a new invoice paid while T11's
  pagination test reads the paid pages, which could fail that test
  intermittently. The page-2 check no longer depends on rows other tests add.
- **(Low) Fixed.** A successful delete from the detail page briefly showed
  "could not be deleted": the dialog took Next's redirect for a failure, and
  now passes it on with `unstable_rethrow`. A browser check failed 2/2 before
  the fix and passes after; it also asserts that the page raises no errors.
- **(Low) Recorded as Q5.** "Pending" in the list (not yet due) differs from
  the dashboard's pending totals (all unpaid). This is a product decision.

The reviewer then re-reviewed the fixes: Approve.

**3. Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `npm test`: exit 0, 28 files / 399 tests.
- `npm run build`: exit 0.
- `npm run test:e2e`: exit 0, 74 passed.
- `E2E_SERVER=start npm run test:e2e`: exit 0, 74 passed.
- The detail spec: 12/12 over three repeats after the fix.
- actionlint and prettier: clean (D1).

## T16 — Database integration tests (completed)

> **For every later session of this run: run `npm test` (and any Vitest
> command) as `E2E_NO_DATABASE=1 npm test`.** Plain `npm test` now rebuilds
> a schema on the development database, which the skill's §3 does not allow
> the run (D24, Q6). The database tests are checked in CI only.

- Branch `night-2026-10-01-t16-db-tests`, base `792ffe1`. Started
  2026-10-02 02:46 (budget 13.79M); completed 2026-10-02 03:01 (budget 13.74M).
- **Checkpoint 3 CI: failed, fight group only** (inherited, Q1). Runs
  36947670498 / 36947670581.

**What the code does**

- `tests/unit/data.test.ts` (new, 13 tests) runs every query in
  `app/lib/data.ts` against `xenocats_vitest`, its own schema, which it
  rebuilds (migrations + seed) when it runs. Expected values are computed
  from the seed. It covers:
  - the latest invoices; the cards for all time and for 12 months, with the
    comparison;
  - monthly totals, including empty months;
  - pagination and page counts;
  - the search over name, email, amount, date and status, case-insensitive,
    with a query that looks like SQL;
  - the three disjoint status filters, alone and combined with a search;
  - the export rows;
  - invoice by id and detail, and the customers queries with their totals;
  - its own invoices, pending vs. overdue, which it deletes afterwards;
  - migration 0003 on a table that already holds invoices (backfill, the
    default, the check), in a scratch schema it drops afterwards.

  It skips without a database URL, or with `E2E_NO_DATABASE=1`.
- `.github/workflows/ci.yml`: a `Database tests` step at the end of the
  build job, against that job's PostgreSQL, run even when the browser tests
  failed.
- `CLAUDE.md` §9, `.claude/rules/testing.md` and `database.md`: the new
  schema, and when the file skips.

**Why**: plan task 16. Design and the conflict with the run's database rule:
D24. A question for a human: Q6.

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 399 passed and 13 skipped (the new
  file).
- `npm run build`: exit 0.
- `npm run test:e2e`: 74 passed.
- `E2E_SERVER=start npm run test:e2e`: **1 failed, 73 passed on the first
  run.** It was a `toBeVisible` assertion; which test is unidentified,
  because that run's full log was not kept. The next three runs passed
  74/74. This task changes no app code and no browser test, so it is
  recorded as an unidentified flake: watch for it.
- actionlint clean; prettier clean (D1).
- **The new tests have not run anywhere yet.** Their first run is this
  commit's CI build job (`Database tests` step), reported in the next entry.

**Review**: `reviewer` — Approve. It worked through every assertion
against the seed and the migrations. Its two Lows were both about this
commit and are handled: keep `next-env.d.ts` out; put the
`E2E_NO_DATABASE=1` rule where a resuming session reads first (the box
above).

## T17 — Login lockout (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24).

- Branch `night-2026-10-01-t17-login-rate-limit`, base `bc4e8f9`. Started
  2026-10-02 03:01 (budget 13.73M); completed 2026-10-02 03:22 (budget 13.66M).
- **T16 CI: failed, fight group only** (inherited, Q1). **The new
  `Database tests` step passed** in the build job: T16's database tests ran
  and passed there on their first run. Runs 36948903376 / 36948903281.

**What the code does**

- `db/migrations/0004_login_failures.sql` (new): the `login_failures` table,
  holding an email, its attempts, and `locked_until`. Not applied to
  `xenocats`; until a human applies it, logins there fail (Q7).
- `app/lib/login-limit.ts` (new):
  - N and M come from `LOGIN_MAX_FAILURES` and `LOGIN_LOCK_MINUTES`
    (default 5 and 15).
  - `claimAttempt` counts every attempt atomically, before the password is
    compared; only attempts 1..N may compare, and the Nth sets the lock.
  - `clearFailures` runs on success.
- `auth.ts`: `authorize` claims first. A refused claim throws a
  `CredentialsSignin` with the code `locked`. An unknown email counts like a
  wrong password.
- `app/lib/actions.ts`: `authenticate` shows "Too many failed logins for
  this email. Try again later." for a locked email.
- `playwright.config.ts`: the test server gets the limits pinned.
- `README.md`: the two variables are documented.
- Tests:
  - unit, for the settings, the key, the claim decisions (a simulated burst
    of N+3 lets exactly N through), clearing, and the message;
  - database (`data.test.ts`, CI only), against real PostgreSQL: N+5
    simultaneous claims over 8 connections let exactly N through, a success
    clears the lock, and an expired lock restarts the count;
  - browser (`login-limit.spec.ts`, each test with its own user): after 5
    failures the email is refused even with the right password, and in any
    case; a success restarts the count.
  - The dashboard spec's wrong-password test now uses an unknown email, so no
    test fails the demo user's login.
- `tests/e2e/invoice-detail.spec.ts` (T12's test): its "Pending" check is
  scoped to the invoice's own section. Just after the client navigation, the
  list's rows can still be in the page, and the unscoped check sometimes
  matched three elements. Caught with its log this time
  (`invoice-detail.spec.ts:49`, strict-mode violation); most likely the
  unidentified `toBeVisible` flake in T16's entry.

**Why**: plan task 17. Design: D25. Proposed follow-ups: Q7.

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 409 passed and 16 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e`: 76 passed.
- `E2E_SERVER=start`: 75 passed with 1 failed (the detail-spec flake above).
  After the fix, the detail spec passed 16/16 (four repeats) on start and the
  full start suite passed 76/76.
- An earlier gate run broke because I edited files while it ran (the dev
  server loaded a half-done edit). It was discarded.
- actionlint and prettier clean.
- The database block runs first in this commit's CI.

**Review**: `reviewer` asked for changes.
- **(Medium) Fixed.** The check-then-compare-then-count design let
  concurrent attempts get past N. Now each attempt is claimed first, in one
  upsert.
- **(Low) Fixed.** The message named the full lock time; it now says "later".
- **(Low) Fixed.** `.env` could change the browser test's limits; they are
  now pinned.

The re-review approved. Its two Lows: D25 and the migration's comment
described the old design (both updated); raising N during a lock lets the
email in early (an operator action, accepted in D25).

## T18 — Security headers (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24).

- Branch `night-2026-10-01-t18-security-headers`, base `1374021`, rebased
  by fast-forward onto `f41719c` (T17's CI fix, below). Started 2026-10-02
  03:22 (budget 13.65M); completed 2026-10-02 03:40 (budget 13.60M).
- **T17 CI (run 36950655255 / 36950655239)**: fight group failed (inherited,
  Q1). **Also failed: the production job's first browser group** (smoke,
  branding, dashboard, customers, invoices, login). The dev job passed the
  same group, and the `Database tests` step passed, including the new
  lockout block on real PostgreSQL. It did not reproduce locally: two
  CI-like runs (`CI=1`, 2 workers, `next start`) passed 32/32. Logs are out
  of reach, so **repair cycle 1** (commit `f41719c`, on T17's branch, T18
  parked meanwhile) split that group into three named steps in both jobs,
  so the next run names the failing area. Its result (runs 36951390394 /
  36951390509): all three new steps **passed** in both jobs, and only the
  inherited fight group failed. The earlier failure was intermittent (it
  failed its CI retry too, but did not recur and never reproduced). It is
  recorded as an unidentified flake; a recurrence will now name its area.

**What the code does**

- `next.config.ts`: security headers on every response.
  - A Content-Security-Policy: `'self'` everywhere, plus `'unsafe-inline'`
    for scripts (Next's inline flight data; a static policy cannot carry a
    nonce) and for styles (the cats', charts' and avatars' inline styles,
    next/font).
  - `img-src` also allows `data:`.
  - `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors
    'none'`.
  - In `next dev` only: `'unsafe-eval'` and WebSockets.
  - Also `X-Content-Type-Options`, `X-Frame-Options: DENY`,
    `Referrer-Policy`, HSTS and a `Permissions-Policy` that turns off camera,
    microphone, geolocation, payment and USB.
- `tests/e2e/security-headers.spec.ts` (new, 5 tests):
  - the headers on four pages;
  - with no CSP violation and no page error: the public pages, three
    dashboard pages (logged in), and `/cats` with a summoned cat;
  - an outside image is blocked, and the watcher reports it.

  It sits in CI's first browser step of both jobs.

**Why**: plan task 18. Design: D26. A nonce-based policy is proposed as Q8.

**Acceptance criteria evidence**: headers present (browser test); pages still
work under them — this spec, plus the whole browser suite (cats, sounds,
forms) running under the policy on both servers.

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 409 passed and 16 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e` and `E2E_SERVER=start`: 81 passed each.
- actionlint and prettier clean.

**Review**: `reviewer` approved, with three Lows, all taken:
- the cats were not watched (now `/cats` with a summoned cat);
- the watcher relied on Chrome's console wording (now the DOM event, plus a
  test proving the watcher reports a violation);
- `blob:` was unused (dropped).

The re-review approved. Its Low (D26 out of date) is fixed.

## T19 — Change password (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24).

- Branch `night-2026-10-01-t19-change-password`, base `fd9a0dc`. Started
  2026-10-02 03:40 (budget 13.60M); completed 2026-10-02 05:53 (budget 13.57M).
- **Gap:** no activity from about 03:49 to 05:49 (session paused, probably a
  usage limit); the timer's next firing resumed it.
- **T18 CI: failed, fight group only** (inherited, Q1). The security-headers
  spec and everything else passed on both servers. Runs 36952074136 /
  36952074265.

**What the code does**

- `app/dashboard/settings/page.tsx` and `app/ui/settings/password-form.tsx`
  (new): a Settings page (behind the login). Its "Change password" form has:
  - the current password, the new one, and the new one again
    (`autocomplete` set);
  - an error region beside each field, and a live message.

  A Settings link is added to the side navigation (`nav-links.tsx`).
- `app/lib/schemas.ts`, `ChangePasswordForm`: the current password is
  required. The new one needs at least 8 characters, at most 72 bytes, the
  same text twice, and must differ from the current one.
- `app/lib/actions.ts`, `changePassword` (a Server Action):
  - checks the session itself and takes the user from the session's email;
  - validates the form, then counts the attempt towards the T17 lockout and
    compares the current password with bcrypt;
  - stores `bcrypt.hash(new, 10)`;
  - returns generic errors only.
- Tests:
  - unit: the schema rules; the action refuses without a session, refuses an
    invalid form before any SQL, refuses a wrong current password without
    updating, refuses a locked account before comparing, and stores a hash
    that bcrypt verifies, for the session's user.
  - browser (`change-password.spec.ts`, on a user of its own): wrong current
    password and mismatched confirmation are refused beside their fields;
    the change succeeds; then the old password is refused and the new one
    logs in. Also, the page is behind the login.

**Why**: plan task 19. Design: D27. Other sessions stay logged in: Q9.

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 418 passed and 16 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e`: 83 passed.
- `E2E_SERVER=start`: 82 passed, 1 failed. The new test timed out waiting
  for network idle after reaching the page by a client-side navigation:
  under `next start` that page keeps prefetching. It now checks the link's
  target and loads the page afresh, as the other specs do. After that, the
  spec passed 6/6 on start (three repeats) and 4/4 on dev, and the full start
  suite passed 83/83.
- actionlint and prettier clean.

**Review**: `reviewer` approved, with no findings.

**UI**: tested in a browser, not seen. A human should look at the Settings
page and the new navigation link at phone and desktop width.

## T20 — Last run's leftovers (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24).

- Branch `night-2026-10-01-t20-leftovers`, base `65303ce`. Started
  2026-10-02 05:54 (budget 13.57M); completed 2026-10-02 06:09 (budget 13.55M).
- **T19 CI: failed, fight group only** (inherited, Q1). The change-password
  tests passed on both servers. Runs 36962202410 / 36962202192.

**What the code does**

- **`next-env.d.ts` untracked** (`git rm --cached`; the plan lifts the
  delete rule for this file only). It was already in `.gitignore`. The file
  stays on disk, and `next typegen`, which CI's type check runs first, writes
  it again: I checked by moving it away, running typegen and type-checking.
  Effect on the run's routine: the "put back `next-env.d.ts`" step after
  each check is now a no-op, since the file is no longer tracked.
- `app/ui/dashboard/sidenav.tsx`: the rail's cat image loads
  `loading="eager"`, as Next's LCP warning asks. The dev server log had 42
  warnings in T19's browser run and **0** in this task's.
- `CLAUDE.md` §9: the stale example `app/query/route.ts` (the file no longer
  exists) is replaced by files that actually fail `.prettierrc`
  (`tsconfig.json`, `global.d.ts`, `app/dashboard/(overview)/loading.tsx`,
  found by checking every tracked source file).
- **Test fix (the gate found it):** `login-limit.spec.ts` and
  `change-password.spec.ts` (T17, T19) filled the login form without waiting
  for hydration, which every other spec avoids. Under `next start`, the
  lockout test then waited in vain for "Invalid credentials." It failed 1 in
  16 repeats before the fix and passed 24/24 after. The production job's
  first browser group in T17's CI ran this test, so this is the likeliest
  cause of that unidentified failure (T18's entry).

**Why**: plan task 20, items as written. The test fix keeps the gate honest.

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 418 passed and 16 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e`: 83 passed, with 0 LCP warnings.
- `E2E_SERVER=start`: 82 passed and 1 failed (the flake above). After the
  fix it passed 83/83, the two specs passed 24/24 on start, and 4/4 on dev.
- prettier clean (D1).

**Review**: not dispatched for this task (three small mechanical edits and a
test wait). Checkpoint 4, next, has the reviewer cover the whole range,
these edits included.

## Checkpoint 4 (after T20; range `792ffe1..41f00b4`, tasks 16–20) (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24, Q6).

- Branch `night-2026-10-01-c4-checkpoint`, base `41f00b4`. Started
  2026-10-02 06:09 (budget 13.55M); completed 2026-10-02 06:18 (budget 13.53M).
- **T20 CI: failed, fight group only** (inherited, Q1). The type check passed
  on CI's fresh checkout without a tracked `next-env.d.ts`. Runs 36963281413
  / 36963280721.
- **For whoever pulls this branch:** the commit that untracks
  `next-env.d.ts` deletes the local copy on checkout. `npm run dev`, `next
  build` or `npx next typegen` writes it again (here: `next typegen`).

**1. Tests.** Gap filled: migration 0004 now has a shape test (a new table
keyed by email, nothing else touched), like 0002 and 0003. No test removed:
none found testing removed behaviour, duplicating another, or unable to fail.
The database block for the lockout now also runs on its own (below).

**2. Quality and security.** The `reviewer` covered the range with the
security rules and approved. The cross-task checks came out clean: no test
fails the demo user's login; the lock message reaches the user; the counter's
SQL; `changePassword`; the CSP; the CI wiring. Findings:
- **(Medium) Escalated, not changed (Q6).** Plain `npm test` now writes a
  schema on the development server, but the skill still tells runs to use it.
  The two fixes are making the tests opt-in, which contradicts T16's wording,
  or changing the skill; both are a human's call.
- **(Low) Fixed.** Login and change-password shared one lockout count, so an
  outsider's failed logins could block a password change. Change-password
  attempts are now counted under their own key, and a unit test asserts it.
- **(Low) Already recorded.** Other sessions survive a password change (Q9);
  `login_failures` grows with made-up emails (Q7).
- **(Low) Fixed.** The lockout database block depended on the block before
  it; the schema reset is now file-level.

The fixes are what the reviewer recommended, so there was no second review
round.

**3. Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 419 passed and 16 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e` and `E2E_SERVER=start`: 83 passed each.
- The database tests run in this commit's CI.

## T21 — Revenue from invoices (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24, Q6).

- Branch `night-2026-10-01-t21-revenue-from-invoices`, base `2090c46`.
  Started 2026-10-02 06:18 (budget 13.53M); completed 2026-10-02 06:27
  (budget 13.51M).
- **Checkpoint 4 CI: failed, fight group only** (inherited, Q1). The
  `Database tests` step passed. Runs 36963973356 / 36963973396.

**What the code does**

- **No application change was needed.** The task says the chart reads the
  static `revenue` table, but the human's commit `c495f87` (2026-10-01,
  before this run) already moved the chart and the cards to totals computed
  from the invoices. Nothing in `app/` reads `revenue` any more (D29).
- `tests/unit/data.test.ts`: a database test (runs in CI) gives the evidence
  for "new invoices show in the chart". The block's own new invoices appear,
  with exact amounts, in this month's and an earlier month's chart totals and
  in the 12-month cards.
- The table is kept, as the task says. Dropping it is proposed in Q10.

**Why**: plan task 21. D29 explains why there was no code change.

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 419 passed and 17 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e` and `E2E_SERVER=start`: 83 passed each.
- The new database test first runs in this commit's CI.

**Review**: not dispatched (a test and records only, no code change).

## T22 — Cat not-found, error and empty states (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24, Q6).

- Branch `night-2026-10-01-t22-cat-states`, base `886bd2b`. Started
  2026-10-02 06:27 (budget 13.51M); completed 2026-10-02 06:38 (budget 13.48M).
- **T21 CI: failed, fight group only** (inherited, Q1). The new chart test
  passed in `Database tests`. Runs 36964595594 / 36964595219.

**What the code does**

- `app/ui/cat-state.tsx` (new): one state, made of a cat (existing artwork,
  decorative and hidden from assistive technology), a heading, a sentence and
  a way on.
- **Not found:** the invoice, invoice-edit and customer-edit pages keep their
  sentence and gain a sleeping cat, an `h1` and a link back to their list.
  New: a root `app/not-found.tsx`, the site's own 404 (it was Next's
  default).
- **Errors:** `app/ui/cat-error.tsx` (new) shows a peeking cat, an `h1` and
  Try again, and logs the error to the console only. The invoices and
  customers `error.tsx` use it, and a new `app/dashboard/error.tsx` covers
  the overview and settings, which had none.
- **Empty:** the invoice table (it showed nothing at all when a search
  matched nothing), the customers table and the dashboard's latest invoices
  (an `h3` inside its card).
- Tests:
  - browser (`cat-states.spec.ts`): the root 404 (status 404, cat, link
    home); an unknown invoice (cat, `h1`, link back); empty searches in both
    lists.
  - unit (`cat-error.test.tsx`): the error state.
  - Both are in CI.

**Why**: plan task 22. Design: D30. Found on the way: a negative `?page=`
crashes the invoice list (Q11, not fixed).

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 420 passed and 17 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e` and `E2E_SERVER=start`: 86 passed each.
- After the review fixes, with a rebuild: the affected specs passed 16/16 on
  dev, and the full start suite passed 86/86.
- actionlint and prettier clean.

**Review**: `reviewer` approved, with three Lows, all fixed:
- the full-page states had no `h1`;
- the latest-invoices empty state was a sibling `h2` of its card;
- the empty lists blamed a search even when none was set.

Its note on who sees the root 404 is now in D30.

**UI**: tested in a browser, not seen. A human should look at the sleeping
cat on the dashboard 404s, the peeking cats in the empty lists, and the root
404 on its starfield, at phone and desktop width.
