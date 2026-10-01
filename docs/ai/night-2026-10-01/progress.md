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
