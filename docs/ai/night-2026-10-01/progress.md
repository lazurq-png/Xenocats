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

## T23 — Keyboard and accessibility pass (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24, Q6).

- Branch `night-2026-10-01-t23-keyboard-a11y`, base `f5682f3`. Started
  2026-10-02 06:38 (budget 13.48M); completed 2026-10-02 06:57 (budget 13.44M).
- **T22 CI: failed, fight group only** (inherited, Q1). The cat-states spec
  and the new unit test passed. Runs 36965442844 / 36965442968.

**What the code does**

- **Skip link** first in the tab order on every dashboard page (layout) and
  on `/cats`; shown when focused; moves focus to the page's content. The
  dashboard layout now holds the single `<main>` landmark (ten pages and the
  error state had their own, two none; theirs became `<div>`s).
- **Visible focus**: a base `:focus-visible` style (2px lime outline) in
  `global.css` for everything without a focus style of its own.
- **Names**: the pagination arrows ("Previous page" / "Next page"); at phone
  width the navigation links, Sign out and the Create Invoice / Create
  Customer links had their only text `display:none` — now `sr-only` below
  `md`.
- `tests/e2e/keyboard.spec.ts` (new, 3 tests, in CI): `/cats` and the
  dashboard by keyboard only (skip link, a visible focus ring at every Tab
  stop, a cat summoned with Enter, the keyboard unaffected with a cat on
  screen, navigation and search by keyboard); every visible control on five
  dashboard pages named, also at 390×844.

**Why**: plan task 23. Design: D31.

**Acceptance criteria evidence**: all four by the browser test on both
servers. The focus check was shown to fail with the new rule removed and to
pass with it (a temporary edit, reverted).

**Verification**: `npm run lint` exit 0, 0 warnings; `next typegen && tsc`
exit 0; `E2E_NO_DATABASE=1 npm test` exit 0, 420 passed and 17 skipped;
`npm run build` exit 0; `npm run test:e2e` and `E2E_SERVER=start` 89 passed
each; actionlint and prettier clean.

**Review**: `reviewer` — Request Changes, two Mediums, both fixed: the focus
check passed even with focus invisible (now strict, and pinned to the new
rule through the skip link); controls unnamed at phone width (now named, and
tested there). Re-review: Approve.

**UI**: tested in a browser, not seen. A human should look at the skip link
(Tab once on any dashboard page), the lime focus ring on the navigation and
links, and the phone-width navigation.

## T24 — Cat intensity setting (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24, Q6).

- Branch `night-2026-10-01-t24-cat-intensity`, base `39ba2d8`. Started
  2026-10-02 06:56 (budget 13.44M); completed 2026-10-02 07:08 (budget 13.40M).
- **T23 CI: failed, fight group only** (inherited, Q1). The keyboard spec
  passed. Runs 36966753140 / 36966753130.

**What the code does**

- `app/ui/xenocats/intensity.ts` (new): calm (at most 2 cats, slow), normal
  (exactly as before), chaos (at most 5, fast). Stored in `localStorage`
  (`xenocats:intensity`); unknown values read as normal. No zero level.
- `app/ui/xenocats/cat-engine.ts`: `configure()` changes how often and how
  many at run time, never above five or below one.
- `app/ui/xenocats/cat-layer.tsx`: on the dashboard (where cats come by
  themselves) the engine follows the stored level, live and across tabs;
  `/cats` is unaffected.
- `app/dashboard/settings/page.tsx`, `app/ui/settings/cat-intensity.tsx`
  (new): a "Cat intensity" radio group on the Settings page.
- Tests:
  - unit (`intensity.test.ts`): the levels; the engine holds 2, 5 and 5 cats
    at the three levels; the clamp; first-cat timing per level; storage.
  - browser (`intensity.spec.ts`): choose chaos, which is stored,
    remembered, and gives two cats within 9.5 s (only chaos can); calm by
    arrow keys, and back.
  - Both are in CI.

**Why**: plan task 24. Design: D32.

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 426 passed and 17 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e` and `E2E_SERVER=start`: 91 passed each.
- After the review fix, the spec passed 6/6 on dev and 6/6 on start.
- actionlint and prettier clean.

**Review**: `reviewer` approved, with two Lows:
- the chaos check could pass under normal: now a check only chaos can meet,
  which also covers the cat layer's wiring;
- a level change restarts the first-spawn delay: accepted (D32).

**UI**: tested in a browser, not seen. A human should look at the Settings
page's Cat intensity cards, and try chaos on the dashboard.

## T25-1 — starting: a nonsense `?page=` no longer crashes the invoice list

- **Kind**: security and quality.
- **What**: `?page=-1` (or `0.5`, `1e9`) on `/dashboard/invoices` reaches the
  SQL as a negative or fractional `OFFSET`, which PostgreSQL rejects, so the
  page falls into the error state (found by T22, Q11). Clamp the page to a
  whole number of at least 1, in a pure, unit-tested parser, as the status
  filter already ignores unknown values.
- **Why it is worth doing**: any visitor can break the list with a hand-edited
  link or a stale bookmark; the fix is small and testable.

## T25-1 — A nonsense `?page=` no longer crashes the invoice list (completed)

> Still in force: run `npm test` as `E2E_NO_DATABASE=1 npm test` (T16, D24, Q6).

- Branch `night-2026-10-01-t25-1-page-param`, base `0df5ef6`. Started
  2026-10-02 07:09 (budget 13.39M); completed 2026-10-02 07:18 (budget 13.37M).
- **T24 CI: failed, fight group only** (inherited, Q1). The intensity specs
  passed. Runs 36967650995 / 36967650922.

**What the code does**

- `app/lib/utils.ts`, `parsePage` (new): a page from the URL is a whole
  number from 1 up; anything else is page 1.
- `app/dashboard/invoices/page.tsx` (server) and
  `app/ui/invoices/pagination.tsx` (client) both use it. Before,
  `Number(page) || 1` let `-1` reach the query as a negative offset, which
  PostgreSQL rejects (the page showed the error state). It also let `2.5`
  through as a fractional page.
- Tests:
  - unit: `parsePage` for whole, missing, zero, negative, fractional and
    non-numeric values;
  - browser (`invoices-filter.spec.ts`): `?page=-1`, `0`, `2.5` and `abc`
    show real rows and no error.

**Why**: plan task 25 (exploration), kind "security and quality". This is
the bug T22 found (Q11, now resolved).

**Verification**
- `npm run lint`: exit 0, 0 warnings.
- `next typegen && tsc`: exit 0.
- `E2E_NO_DATABASE=1 npm test`: exit 0, 428 passed and 17 skipped.
- `npm run build`: exit 0.
- `npm run test:e2e` and `E2E_SERVER=start`: 92 passed each.
- The browser test **failed with the old parsing restored temporarily** and
  passes with the fix. Its first version passed even on the old code (the
  loading skeleton has rows, and the error streams in later); it now waits
  for real rows.

**Review**: `reviewer` approved, with no findings. Of the four values the
browser test tries, only `-1` reproduced the crash (`2.5` gives a whole
offset); the unit test covers fractional input.

## Morning report

### Goal

- Goal, as written in `plan.md`: "Friday 08:30" → **deadline 2026-10-02
  08:30**.
- Report started at 2026-10-02 07:20.
- **What ended the run:** the plan's tasks ran out. Tasks 1–24 and the four
  checkpoints are done, and so is one exploration item (task 25).
  Exploration stopped at 07:20, 70 minutes before the goal, by choice: the
  next item's CI result would have come close to 08:30, and this session had
  already lost about two hours (03:49–05:49) to a pause.

### Tasks

Every task in the plan was **completed**; none is provisional, abandoned or
unstarted. Checkpoints 1–4 were completed too. Task 25 (exploration) produced
one item, T25-1.

Each entry above has an "Acceptance criteria evidence" line, which says which
criteria a test ran and which only a reading covers. These are covered only
by reading:
- T1/T2: the score while the pointer is locked, in a real browser on
  GitHub's runner (Q1).
- T12: the failure message in the delete dialog.
- T13: the 422 above 10 000 rows (unit tests only).
- T14: the migration's backfill of existing rows, until T16 added a database
  test for it, which runs in CI.
- T16–T25-1: the database tests, which run only in CI (`Database tests`
  passed on every run since T16).
- All UI: tested in a browser, **never seen**.

### Completed

| Task | Branch | SHA | Verification run (local) | CI |
| ---- | ------ | --- | ------------------------ | -- |
| T1 Survival | `night-2026-10-01-t1-survival` | `481610b` | full gate (§2 step 1) — see entry | **CI passed** — runs 36866340434, 36866336836 |
| T2 Taming | `…-t2-taming` | `87faef3` | same | **CI passed** — 36873731696, 36873722004 |
| T3 Page hits | `…-t3-page-hits` | `fbf3daf` | same | **CI passed** — 36876490694, 36876486641 |
| T4 Sounds | `…-t4-sounds` | `77a719b` | same | **CI passed** — 36877985017, 36877975042 |
| T5 Field guide | `…-t5-field-guide` | `e8f8d23` | same | **CI passed** — 36880762566, 36880753894 |
| Checkpoint 1 | `…-c1-checkpoint` | `6a30700` | same | **abandoned after 3 CI cycles (browser jobs, fight group)** — Q1 |
| T6 Pet a cat | `…-t6-pet-cat` | `5778966` | full gate — see entry | CI failed, fight group only (inherited, Q1) |
| T7 Combos | `…-t7-combos` | `c697632` | same | fight only (Q1) |
| T8 Touch | `…-t8-touch` | `fab97df` | same | fight only (Q1) |
| T9 Keys and indexes | `…-t9-keys-indexes` | `e61493b` | same | fight only (Q1); migrate+seed passed |
| T10 Customer CRUD | `…-t10-customer-crud` | `be47583` | same | fight only (Q1) |
| Checkpoint 2 | `…-c2-checkpoint` | `623d402` | same | fight only (Q1) |
| T11 Status filter | `…-t11-status-filter` | `51a5f13` | same | fight only (Q1) |
| T12 Invoice detail | `…-t12-invoice-detail` | `4b4f512` | same | fight only (Q1) |
| T13 CSV export | `…-t13-csv-export` | `ff07941` | same | fight only (Q1)¹ |
| T14 Due dates | `…-t14-due-dates` | `6e5f60d` | same | fight only (Q1)¹ |
| T15 Invoice CRUD e2e | `…-t15-invoice-crud-e2e` | `9ea0277` | same | fight only (Q1) |
| Checkpoint 3 | `…-c3-checkpoint` | `792ffe1` | same | fight only (Q1) |
| T16 Database tests | `…-t16-db-tests` | `bc4e8f9` | same (unit with `E2E_NO_DATABASE=1`) | fight only (Q1); **Database tests passed** |
| T17 Login lockout | `…-t17-login-rate-limit` | `f41719c` | same | **CI failed, fixed in 1 cycle (production job, first browser group)**²; then fight only |
| T18 Security headers | `…-t18-security-headers` | `fd9a0dc` | same | fight only (Q1) |
| T19 Change password | `…-t19-change-password` | `65303ce` | same | fight only (Q1) |
| T20 Leftovers | `…-t20-leftovers` | `41f00b4` | same | fight only (Q1) |
| Checkpoint 4 | `…-c4-checkpoint` | `2090c46` | same | fight only (Q1) |
| T21 Revenue from invoices | `…-t21-revenue-from-invoices` | `886bd2b` | same | fight only (Q1) |
| T22 Cat states | `…-t22-cat-states` | `f5682f3` | same | fight only (Q1) |
| T23 Keyboard and a11y | `…-t23-keyboard-a11y` | `39ba2d8` | same | fight only (Q1) |
| T24 Cat intensity | `…-t24-cat-intensity` | `0df5ef6` | same | fight only (Q1) |
| T25-1 `?page=` crash | `…-t25-1-page-param` | `4b98d0a` | same | fight only (Q1) — runs 36968386513, 36968386288 |

"fight only (Q1)" means **CI failed**: only the "Browser tests (fight)" step
failed, in both browser jobs. This is the failure checkpoint 1 left open,
and every other step passed. The run URLs are in each next task's progress
entry.

¹ The first poll for T13 and T14 found no runs, because I passed a short
SHA (my error). Re-polled with full SHAs, both runs were observed.
² The production job's first browser group failed once and did not
reproduce locally. Cycle 1 split that step into three named steps, and all
three passed from then on. The likeliest cause was found later (T20): a
login test filled the form before hydration.

### Code by task

The diff of every task from its base to its branch tip, with its "what" and
"why" taken from its entry above. State files are excluded. Two notes:
- Checkpoint 1's range includes its three CI-fix commits.
- T17's range includes the CI-split commit `f41719c`, and so does T18's,
  because T18 was fast-forwarded onto it.

#### T1 — `night-2026-10-01-t1-survival`

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

<details><summary>Code:  10 files changed, 1237 insertions(+), 22 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/cat-gallery.tsx b/app/ui/xenocats/cat-gallery.tsx
index 030c034..fb47240 100644
--- a/app/ui/xenocats/cat-gallery.tsx
+++ b/app/ui/xenocats/cat-gallery.tsx
@@ -7,24 +7,27 @@ import { catArt } from './cat-art';
 import { CatSprite } from './cat-sprite';
 import { CAT_TYPES, type CatType } from './cat-types';
 import { XenocatCursorProvider } from './fake-cursor';
+import Fight from './fight';
 
 /**
  * Every cat type with two Summon buttons: awake, to pounce as soon as it arrives,
  * or asleep, to nap and wake first as the dashboard's cats do (and show both poses'
  * artwork). Cats only come when summoned here, so the page is calm to browse and
- * predictable to test.
+ * predictable to test. Above them, Fight a cat; no cat can be summoned during a game.
  */
 export default function CatGallery() {
+  const [fighting, setFighting] = useState(false);
   return (
     <XenocatCursorProvider>
       <XenocatCatsProvider autoSpawn={false}>
-        <Roster />
+        <Fight onPlayingChange={setFighting} />
+        <Roster disabled={fighting} />
       </XenocatCatsProvider>
     </XenocatCursorProvider>
   );
 }
 
-function Roster() {
+function Roster({ disabled }: { disabled: boolean }) {
   const cats = useXenocats();
   const [status, setStatus] = useState('');
 
@@ -42,7 +45,12 @@ function Roster() {
 
   return (
     <>
-      <p role="status" aria-live="polite" className="mb-4 min-h-5 text-sm text-aura">
+      <p
+        role="status"
+        aria-live="polite"
+        data-testid="summon-status"
+        className="mb-4 min-h-5 text-sm text-aura"
+      >
         {status}
       </p>
       <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
@@ -76,6 +84,7 @@ function Roster() {
                 className="justify-center whitespace-nowrap px-1 text-[13px]"
                 data-testid={`summon-${type.id}`}
                 aria-label={`Summon ${type.name} awake`}
+                disabled={disabled}
                 onClick={() => summon(type, false)}
               >
                 Summon awake
@@ -84,6 +93,7 @@ function Roster() {
                 className="justify-center whitespace-nowrap px-1 text-[13px]"
                 data-testid={`summon-asleep-${type.id}`}
                 aria-label={`Summon ${type.name} asleep`}
+                disabled={disabled}
                 onClick={() => summon(type, true)}
               >
                 Summon asleep
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index 076a743..dce1d79 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -23,6 +23,8 @@ export type Xenocats = {
    * and wake first. False if 5 are already there.
    */
   summon(typeId: string, options?: { asleep?: boolean }): boolean;
+  /** How many of these cats are on screen now. */
+  count(): number;
 };
 
 const CatsContext = createContext<Xenocats | null>(null);
@@ -80,6 +82,8 @@ export function XenocatCatsProvider({
         // The pointer is off the page: wait, rather than block clicks with an effect
         // nobody sees.
         if (!cursor.isPresent()) return false;
+        // The page is drawing its own pointer (a locked Fight game): wait until it is done.
+        if (cursor.isHidden()) return false;
         return cursor.attack(type.effect, centre);
       });
       if (changed) setCats(snapshot(engine));
@@ -100,6 +104,7 @@ export function XenocatCatsProvider({
         if (cat) setCats(snapshot(engine));
         return cat !== null;
       },
+      count: () => engine.cats().length,
     }),
     [engine, cursor]
   );
diff --git a/app/ui/xenocats/fake-cursor.tsx b/app/ui/xenocats/fake-cursor.tsx
index c58acbb..38a3a9e 100644
--- a/app/ui/xenocats/fake-cursor.tsx
+++ b/app/ui/xenocats/fake-cursor.tsx
@@ -3,7 +3,7 @@
 import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
 import { type CursorController, createCursorController } from './cursor-controller';
 import { type CursorKind, cursorKindFor } from './cursor-kind';
-import { type Effect, MAX_DECOYS, type Vec } from './effects';
+import { type CursorLook, type Effect, MAX_DECOYS, type Vec } from './effects';
 import { type Random, createRandom, freshSeed } from './random';
 
 export type XenocatCursor = {
@@ -19,6 +19,10 @@ export type XenocatCursor = {
   now(): number;
   /** The page's one seeded random source, shared with the cats. */
   random: Random;
+  /** Hides the fake cursor while the page draws a pointer of its own (pointer lock). */
+  hide(hidden: boolean): void;
+  /** True while hidden: no cat may attack a cursor nobody can see. */
+  isHidden(): boolean;
 };
 
 const CursorContext = createContext<XenocatCursor | null>(null);
@@ -56,6 +60,19 @@ const PRESS_ENDS = new Set(['click', 'auxclick', 'contextmenu']);
 
 export const HIDE_CURSOR_CLASS = 'xenocat-cursor-hidden';
 
+/** Draws a cursor element (or one of its decoys) at `at`, looking as `look` says. */
+export function placeCursor(element: HTMLElement, at: Vec, look: CursorLook) {
+  const filter = [
+    look.blur > 0 ? `blur(${look.blur}px)` : '',
+    look.tint ? `drop-shadow(0 0 3px ${look.tint}) drop-shadow(0 0 6px ${look.tint})` : '',
+  ]
+    .filter(Boolean)
+    .join(' ');
+  element.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) scale(${look.scale})`;
+  element.style.opacity = String(look.visible ? look.opacity : 0);
+  element.style.filter = filter;
+}
+
 /**
  * Hides the system cursor, draws a fake one that follows the pointer, and lets cats
  * attack it. Only on devices with a precise pointer: there is no cursor to fake on
@@ -81,6 +98,7 @@ export function XenocatCursorProvider({
   const cursorRef = useRef<HTMLDivElement>(null);
   const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
   const nowRef = useRef(now);
+  const hiddenRef = useRef(false);
 
   useEffect(() => {
     nowRef.current = now;
@@ -144,19 +162,9 @@ export function XenocatCursorProvider({
     let frameId = 0;
     const draw = () => {
       const time = nowRef.current();
-      const look = controller.frame(time);
-      const opacity = String(look.visible ? look.opacity : 0);
-      const filter = [
-        look.blur > 0 ? `blur(${look.blur}px)` : '',
-        look.tint ? `drop-shadow(0 0 3px ${look.tint}) drop-shadow(0 0 6px ${look.tint})` : '',
-      ]
-        .filter(Boolean)
-        .join(' ');
-      const place = (element: HTMLElement, at: Vec) => {
-        element.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) scale(${look.scale})`;
-        element.style.opacity = opacity;
-        element.style.filter = filter;
-      };
+      const drawn = controller.frame(time);
+      const look = hiddenRef.current ? { ...drawn, visible: false, decoys: undefined } : drawn;
+      const place = (element: HTMLElement, at: Vec) => placeCursor(element, at, look);
 
       const cursor = cursorRef.current;
       if (cursor) {
@@ -193,6 +201,10 @@ export function XenocatCursorProvider({
       isPresent: () => controller.isPresent(),
       now: () => nowRef.current(),
       random,
+      hide: (hidden) => {
+        hiddenRef.current = hidden;
+      },
+      isHidden: () => hiddenRef.current,
     }),
     [controller, random]
   );
@@ -233,7 +245,7 @@ export function XenocatCursorProvider({
 }
 
 // Each shape is drawn so that its hotspot sits at the element's origin.
-function CursorShape({ kind }: { kind: CursorKind }) {
+export function CursorShape({ kind }: { kind: CursorKind }) {
   const stroke = { stroke: '#ffffff', strokeWidth: 1.3, strokeLinejoin: 'round' as const };
   switch (kind) {
     case 'pointer':
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
new file mode 100644
index 0000000..3aa50c1
--- /dev/null
+++ b/app/ui/xenocats/fight.tsx
@@ -0,0 +1,475 @@
+'use client';
+
+import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
+import { createPortal } from 'react-dom';
+import { Button } from '@/app/ui/button';
+import { useXenocats } from './cat-layer';
+import { catArt } from './cat-art';
+import { CatSprite } from './cat-sprite';
+import { CAT_TYPES, catTypeById } from './cat-types';
+import { CAT_CONFIG } from './config';
+import { MAX_DECOYS, type Vec } from './effects';
+import { CursorShape, placeCursor, useXenocatCursor } from './fake-cursor';
+import { type LockedPointer, createLockedPointer } from './locked-pointer';
+import {
+  SURVIVAL_BEST_KEY,
+  type Survival,
+  type SurvivalSnapshot,
+  bestScore,
+  createGameClock,
+  createSurvival,
+} from './survival';
+
+// Fight a cat, on the /cats page. Start asks for pointer lock: the browser hides the
+// system pointer and the game owns the pointer's position, so the cats attack that
+// pointer itself (locked-pointer.ts). Esc releases the lock and ends the game;
+// losing it any other way (another tab, another window) pauses it. Where pointer
+// lock is refused or missing, the game runs with the page's fake cursor instead.
+
+type Mode = 'locked' | 'fallback';
+type Phase = 'idle' | 'playing' | 'paused' | 'over';
+
+type Game = {
+  survival: Survival;
+  clock: ReturnType<typeof createGameClock>;
+  mode: Mode;
+  pointer: LockedPointer | null;
+};
+
+function readBest(): number | null {
+  try {
+    const value = Number(window.localStorage.getItem(SURVIVAL_BEST_KEY));
+    return Number.isInteger(value) && value > 0 ? value : null;
+  } catch {
+    return null;
+  }
+}
+
+/** Another tab may set a new best. */
+function subscribeBest(onChange: () => void) {
+  window.addEventListener('storage', onChange);
+  return () => window.removeEventListener('storage', onChange);
+}
+
+function writeBest(score: number) {
+  try {
+    window.localStorage.setItem(SURVIVAL_BEST_KEY, String(score));
+  } catch {
+    // Storage blocked or full: the best score just isn't kept.
+  }
+}
+
+/** Asks for pointer lock on <body>. Resolves false if it is missing or refused. */
+function requestLock(): Promise<boolean> {
+  const target = document.body;
+  if (typeof target.requestPointerLock !== 'function') return Promise.resolve(false);
+  return new Promise((resolve) => {
+    let settled = false;
+    const finish = (locked: boolean) => {
+      if (settled) return;
+      settled = true;
+      document.removeEventListener('pointerlockchange', onChange);
+      document.removeEventListener('pointerlockerror', onError);
+      window.clearTimeout(timeout);
+      resolve(locked);
+    };
+    const onChange = () => finish(document.pointerLockElement === target);
+    const onError = () => finish(false);
+    // Some browsers neither grant nor refuse when they will not lock.
+    const timeout = window.setTimeout(() => {
+      const locked = document.pointerLockElement === target;
+      finish(locked);
+      // The game has gone on without the lock; release it if it is granted late.
+      if (!locked) {
+        const release = () => {
+          if (document.pointerLockElement === target) document.exitPointerLock();
+        };
+        document.addEventListener('pointerlockchange', release, { once: true });
+      }
+    }, 1000);
+    document.addEventListener('pointerlockchange', onChange);
+    document.addEventListener('pointerlockerror', onError);
+    try {
+      // A promise in current browsers, undefined in older ones.
+      const result = target.requestPointerLock() as unknown;
+      if (result instanceof Promise) result.catch(() => finish(false));
+    } catch {
+      finish(false);
+    }
+  });
+}
+
+const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
+
+export default function Fight({
+  onPlayingChange,
+}: {
+  /** True from Start until the game is over, paused included. */
+  onPlayingChange?: (playing: boolean) => void;
+}) {
+  const cursor = useXenocatCursor();
+  const cats = useXenocats();
+  const [phase, setPhase] = useState<Phase>('idle');
+  const [mode, setMode] = useState<Mode>('fallback');
+  const [snap, setSnap] = useState<SurvivalSnapshot | null>(null);
+  // Read on every render, so the best a game just wrote shows at once.
+  const best = useSyncExternalStore(subscribeBest, readBest, () => null);
+  const [message, setMessage] = useState('');
+  const gameRef = useRef<Game | null>(null);
+  const phaseRef = useRef<Phase>('idle');
+  const pointerRef = useRef<HTMLDivElement>(null);
+  const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
+  const startRef = useRef<HTMLDivElement>(null);
+  const dialogRef = useRef<HTMLDivElement>(null);
+  // Set from Start until the game begins: asking for the lock can take a second.
+  const startingRef = useRef(false);
+
+  const changePhase = useCallback(
+    (next: Phase) => {
+      phaseRef.current = next;
+      setPhase(next);
+      onPlayingChange?.(next === 'playing' || next === 'paused');
+    },
+    [onPlayingChange]
+  );
+
+  const finish = useCallback(() => {
+    const game = gameRef.current;
+    if (!game || phaseRef.current === 'over' || phaseRef.current === 'idle') return;
+    const final = game.survival.snapshot();
+    const kept = bestScore(readBest(), final.score);
+    writeBest(kept);
+    setSnap(final);
+    if (document.pointerLockElement) document.exitPointerLock();
+    cursor.hide(false);
+    const waves = final.score === 1 ? '1 wave' : `${final.score} waves`;
+    setMessage(`Game over. You survived ${waves}. Best: ${kept}.`);
+    changePhase('over');
+  }, [cursor, changePhase]);
+
+  const pause = useCallback(() => {
+    const game = gameRef.current;
+    if (!game || phaseRef.current !== 'playing') return;
+    game.clock.pause(performance.now());
+    cursor.hide(false);
+    setMessage('Paused.');
+    changePhase('paused');
+  }, [cursor, changePhase]);
+
+  const begin = (mode: Mode, game: Game) => {
+    gameRef.current = game;
+    setMode(mode);
+    setSnap(game.survival.snapshot());
+    cursor.hide(mode === 'locked');
+    setMessage(
+      mode === 'locked'
+        ? 'The cats are coming. Press Esc to stop.'
+        : 'The cats are coming. Press Esc or End game to stop.'
+    );
+    changePhase('playing');
+  };
+
+  const start = async () => {
+    if (startingRef.current || phaseRef.current === 'playing' || phaseRef.current === 'paused') {
+      return;
+    }
+    startingRef.current = true;
+    const locked = await requestLock();
+    startingRef.current = false;
+    const viewport = viewportSize();
+    const at: Vec = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
+    const clock = createGameClock(performance.now());
+    begin(locked ? 'locked' : 'fallback', {
+      survival: createSurvival({ random: cursor.random, types: CAT_TYPES, viewport, now: 0 }),
+      clock,
+      mode: locked ? 'locked' : 'fallback',
+      pointer: locked ? createLockedPointer({ viewport, start: at, random: cursor.random }) : null,
+    });
+  };
+
+  const resume = async () => {
+    const game = gameRef.current;
+    if (!game || phaseRef.current !== 'paused') return;
+    if (game.mode === 'locked' && !(await requestLock())) {
+      // Refused this time: carry on with the fake cursor.
+      game.mode = 'fallback';
+      game.pointer = null;
+      setMode('fallback');
+    }
+    game.clock.resume(performance.now());
+    cursor.hide(game.mode === 'locked');
+    setMessage('');
+    changePhase('playing');
+  };
+
+  // Move focus into the game when it starts and back to Start when it is over.
+  useEffect(() => {
+    if (phase === 'playing' || phase === 'paused') dialogRef.current?.focus();
+    if (phase === 'over') startRef.current?.querySelector('button')?.focus();
+  }, [phase]);
+
+  // The game loop, and everything that can pause or end the game.
+  const running = phase === 'playing' || phase === 'paused';
+  useEffect(() => {
+    if (!running) return;
+    const game = gameRef.current;
+    if (!game) return;
+
+    let frameId = 0;
+    const loop = () => {
+      if (phaseRef.current === 'playing') {
+        const now = game.clock.now(performance.now());
+        let at: Vec;
+        if (game.mode === 'locked' && game.pointer) {
+          const look = game.pointer.frame(now);
+          at = { x: look.x, y: look.y };
+          const element = pointerRef.current;
+          if (element) placeCursor(element, look, look);
+          const decoys = look.decoys ?? [];
+          decoyRefs.current.forEach((decoy, i) => {
+            if (!decoy) return;
+            if (i < decoys.length) placeCursor(decoy, decoys[i], look);
+            else decoy.style.opacity = '0';
+          });
+        } else {
+          const viewport = viewportSize();
+          at = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
+        }
+        const landed = game.survival.tick(now, at, CAT_CONFIG.maxCats - cats.count());
+        for (const cat of landed) {
+          const type = catTypeById(cat.typeId);
+          if (!type) continue;
+          // Only one effect at a time: a cat landing during another's still costs a life.
+          if (game.mode === 'locked' && game.pointer) game.pointer.attack(type.effect, cat, now);
+          else cursor.attack(type.effect, cat);
+        }
+        const snapshot = game.survival.snapshot();
+        setSnap(snapshot);
+        if (snapshot.status === 'over') {
+          finish();
+          return;
+        }
+      }
+      frameId = requestAnimationFrame(loop);
+    };
+    frameId = requestAnimationFrame(loop);
+
+    const onMouseMove = (event: MouseEvent) => {
+      if (phaseRef.current !== 'playing' || !game.pointer) return;
+      if (document.pointerLockElement !== document.body) return;
+      game.pointer.move(event.movementX, event.movementY);
+    };
+    const onMouseDown = (event: MouseEvent) => {
+      if (phaseRef.current !== 'playing' || event.button !== 0 || !game.pointer) return;
+      if (document.pointerLockElement !== document.body) return;
+      // Clicks are blocked while an effect runs, as they are for the fake cursor.
+      if (game.pointer.activeEffectId(game.clock.now(performance.now())) !== null) return;
+      if (game.survival.click(game.pointer.position())) setSnap(game.survival.snapshot());
+    };
+    const onLockChange = () => {
+      // The game releasing the lock itself (it is over) is not a loss.
+      if (phaseRef.current !== 'playing' || game.mode !== 'locked') return;
+      if (document.pointerLockElement === document.body) return;
+      // Esc leaves the page focused and visible; a tab or window switch does not.
+      // Their blur and visibility events can arrive just after the lock is lost.
+      window.setTimeout(() => {
+        if (document.hasFocus() && document.visibilityState === 'visible') finish();
+        else pause();
+      }, 100);
+    };
+    const onKeyDown = (event: KeyboardEvent) => {
+      if (event.key === 'Escape') finish();
+    };
+    const onHidden = () => {
+      if (document.visibilityState === 'hidden') pause();
+    };
+    const onResize = () => {
+      game.survival.resize(viewportSize());
+      game.pointer?.resize(viewportSize());
+    };
+
+    document.addEventListener('mousemove', onMouseMove);
+    document.addEventListener('mousedown', onMouseDown);
+    document.addEventListener('pointerlockchange', onLockChange);
+    document.addEventListener('visibilitychange', onHidden);
+    window.addEventListener('keydown', onKeyDown);
+    window.addEventListener('blur', pause);
+    window.addEventListener('resize', onResize);
+    return () => {
+      cancelAnimationFrame(frameId);
+      document.removeEventListener('mousemove', onMouseMove);
+      document.removeEventListener('mousedown', onMouseDown);
+      document.removeEventListener('pointerlockchange', onLockChange);
+      document.removeEventListener('visibilitychange', onHidden);
+      window.removeEventListener('keydown', onKeyDown);
+      window.removeEventListener('blur', pause);
+      window.removeEventListener('resize', onResize);
+    };
+  }, [running, cursor, cats, finish, pause]);
+
+  // Leaving the page mid-game: give the pointer back.
+  useEffect(
+    () => () => {
+      if (document.pointerLockElement) document.exitPointerLock();
+      cursor.hide(false);
+    },
+    [cursor]
+  );
+
+  // Without pointer lock, a click lands where the real pointer is; the fake cursor
+  // provider has already swallowed it if an effect is running.
+  const onOverlayPointerDown = (event: React.PointerEvent) => {
+    const game = gameRef.current;
+    if (!game || game.mode !== 'fallback' || phaseRef.current !== 'playing') return;
+    if (event.button !== 0) return;
+    if (game.survival.click({ x: event.clientX, y: event.clientY })) {
+      setSnap(game.survival.snapshot());
+    }
+  };
+
+  const size = CAT_CONFIG.catSize;
+
+  return (
+    <section
+      aria-labelledby="fight-heading"
+      className="mb-10 rounded-2xl border border-line bg-panel p-6"
+    >
+      <h2 id="fight-heading" className="font-display text-2xl font-semibold text-cream">
+        Fight a cat
+      </h2>
+      <p className="mt-2 max-w-2xl text-sm text-aura">
+        <span className="font-semibold text-white">Survival.</span> Cats come in waves, faster and
+        more often each time. Click a cat to banish it; every cat that reaches your pointer costs
+        one of 3 lives. Your pointer is locked to the game until you press Esc.
+      </p>
+      <div ref={startRef} className="mt-4 flex flex-wrap items-center gap-4">
+        <Button data-testid="fight-start" onClick={start} disabled={running}>
+          {phase === 'over' ? 'Play again' : 'Start Survival'}
+        </Button>
+        <p data-testid="fight-best" className="text-sm text-aura">
+          Best:{' '}
+          {best === null ? 'no waves survived yet' : `${best} ${best === 1 ? 'wave' : 'waves'}`}
+        </p>
+      </div>
+      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-plasma">
+        {phase === 'over' ? message : ''}
+      </p>
+
+      {running &&
+        snap &&
+        createPortal(
+          <div
+            ref={dialogRef}
+            role="dialog"
+            aria-modal="true"
+            aria-label="Fight a cat: Survival"
+            tabIndex={-1}
+            data-testid="fight-overlay"
+            data-mode={mode}
+            data-phase={phase}
+            onPointerDown={onOverlayPointerDown}
+            className="fixed inset-0 z-[9998] select-none bg-void/85 outline-none"
+          >
+            <div className="flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
+              <p data-testid="fight-lives" data-lives={snap.lives}>
+                Lives: {snap.lives}
+              </p>
+              <p data-testid="fight-wave" data-wave={snap.wave}>
+                Wave {snap.wave}
+              </p>
+              <p data-testid="fight-score">Survived: {snap.score}</p>
+              <p role="status" className="text-plasma">
+                {message}
+              </p>
+              {mode === 'fallback' && phase === 'playing' && (
+                <Button className="ml-auto" onClick={finish}>
+                  End game
+                </Button>
+              )}
+            </div>
+
+            <div aria-hidden="true">
+              {snap.cats.map((cat) => (
+                <div
+                  key={cat.id}
+                  data-testid="fight-cat"
+                  data-cat-type={cat.typeId}
+                  className="absolute"
+                  style={{
+                    left: cat.x - size / 2,
+                    top: cat.y - size / 2,
+                    width: size,
+                    height: size,
+                  }}
+                >
+                  <FightCatSprite typeId={cat.typeId} size={size} />
+                </div>
+              ))}
+            </div>
+
+            {phase === 'paused' && (
+              <div className="absolute inset-0 flex items-center justify-center">
+                <div className="rounded-2xl border border-line bg-panel p-6 text-center">
+                  <p className="font-display text-xl text-cream">Paused</p>
+                  <p className="mt-2 text-sm text-aura">The cats wait for you.</p>
+                  <div className="mt-4 flex justify-center gap-3">
+                    <Button onClick={resume}>Resume</Button>
+                    <Button onClick={finish}>End game</Button>
+                  </div>
+                </div>
+              </div>
+            )}
+
+            {mode === 'locked' && phase === 'playing' && (
+              <div aria-hidden="true">
+                {Array.from({ length: MAX_DECOYS }, (_, i) => (
+                  <div
+                    key={i}
+                    ref={(element) => {
+                      decoyRefs.current[i] = element;
+                    }}
+                    className="pointer-events-none fixed left-0 top-0 origin-top-left"
+                    style={{ opacity: 0 }}
+                  >
+                    <CursorShape kind="arrow" />
+                  </div>
+                ))}
+                <div
+                  ref={pointerRef}
+                  data-testid="fight-pointer"
+                  className="pointer-events-none fixed left-0 top-0 origin-top-left"
+                  style={{ opacity: 0 }}
+                >
+                  <CursorShape kind="arrow" />
+                </div>
+              </div>
+            )}
+          </div>,
+          document.body
+        )}
+    </section>
+  );
+}
+
+// Redrawn every frame as the cats move; the sprite itself never changes.
+const FightCatSprite = memo(function FightCatSprite({
+  typeId,
+  size,
+}: {
+  typeId: string;
+  size: number;
+}) {
+  const type = catTypeById(typeId);
+  if (!type) return null;
+  return (
+    <div className="xenocat-ready h-full w-full">
+      <CatSprite
+        palette={type.palette}
+        look={type.look}
+        pose="awake"
+        size={size}
+        art={catArt(type.id, 'awake')}
+      />
+    </div>
+  );
+});
diff --git a/app/ui/xenocats/locked-pointer.ts b/app/ui/xenocats/locked-pointer.ts
new file mode 100644
index 0000000..f80a277
--- /dev/null
+++ b/app/ui/xenocats/locked-pointer.ts
@@ -0,0 +1,71 @@
+// The pointer while the page holds pointer lock (Fight a cat). The browser then
+// hides the system pointer and reports only how far the mouse moved, so the game
+// keeps the pointer's position itself, and a cat's attack moves that position, not
+// a drawing laid over it: when the effect ends, the pointer stays where the effect
+// left it instead of snapping back. No DOM and no clock, like cursor-controller.ts,
+// whose effect stepping it reuses.
+
+import { createCursorController } from './cursor-controller';
+import {
+  type CursorLook,
+  type Effect,
+  type Size,
+  type Vec,
+  clampToViewport,
+  restingLook,
+} from './effects';
+import type { Random } from './random';
+
+export type LockedPointer = ReturnType<typeof createLockedPointer>;
+
+export function createLockedPointer(options: { viewport: Size; start: Vec; random: Random }) {
+  const controller = createCursorController({ viewport: options.viewport, random: options.random });
+  let viewport = options.viewport;
+  /** Where the mouse alone has taken the pointer: the effect's input. */
+  let moved = clampToViewport(options.start, viewport);
+  let look: CursorLook = restingLook(moved);
+  let wasActive = false;
+  controller.pointerMove(moved);
+
+  return {
+    /** The mouse moved by (dx, dy): `movementX` / `movementY` under pointer lock. */
+    move(dx: number, dy: number) {
+      moved = clampToViewport({ x: moved.x + dx, y: moved.y + dy }, viewport);
+      controller.pointerMove(moved);
+    },
+
+    resize(size: Size) {
+      viewport = size;
+      controller.resize(size);
+      moved = clampToViewport(moved, viewport);
+      controller.pointerMove(moved);
+    },
+
+    /** Starts `effect` from a cat at `cat`. False while another effect still runs. */
+    attack(effect: Effect, cat: Vec, now: number): boolean {
+      return controller.attack(effect, cat, now);
+    },
+
+    activeEffectId(now: number): string | null {
+      return controller.activeEffectId(now);
+    },
+
+    /** Advances one frame; returns where the pointer is and how it looks. */
+    frame(now: number): CursorLook {
+      const active = controller.isBlocking(now);
+      if (wasActive && !active) {
+        // The effect is over: the pointer is where the effect put it.
+        moved = clampToViewport({ x: look.x, y: look.y }, viewport);
+        controller.pointerMove(moved);
+      }
+      wasActive = active;
+      look = controller.frame(now);
+      return look;
+    },
+
+    /** Where the pointer is: what clicks hit and what cats chase. */
+    position(): Vec {
+      return { x: look.x, y: look.y };
+    },
+  };
+}
diff --git a/app/ui/xenocats/survival.ts b/app/ui/xenocats/survival.ts
new file mode 100644
index 0000000..ad7252a
--- /dev/null
+++ b/app/ui/xenocats/survival.ts
@@ -0,0 +1,268 @@
+// Fight a cat, Survival mode, as a pure state machine: time, the pointer and the
+// random source are passed in, so tests drive it tick by tick (like cat-engine.ts).
+//
+// Cats arrive in waves from the edges of the screen and chase the pointer. One that
+// reaches it lands its attack and costs a life; clicking one banishes it. A wave is
+// survived once all its cats have arrived and none is left. Every wave brings more
+// cats, sooner and faster. The score is the number of waves survived.
+
+import type { CatType } from './cat-types';
+import { CAT_CONFIG } from './config';
+import type { Size, Vec } from './effects';
+import type { Random } from './random';
+
+export type SurvivalConfig = {
+  lives: number;
+  /** Never more cats on screen than this. */
+  maxCats: number;
+  /** An attack lands when a cat's centre comes this close to the pointer, px. */
+  hitRadius: number;
+  /** A click banishes a cat whose centre is at most this far away, px. */
+  clickRadius: number;
+  /** New cats appear at least this far from the pointer, px. */
+  keepAwayFromPointer: number;
+  /** The quiet moment before each wave, ms. */
+  breakMs: number;
+  /** Wave 1; every later wave grows from it (waveSpec). */
+  firstWave: WaveSpec;
+  /** Each wave: one more cat, spawns this much sooner, cats this much faster. */
+  countStep: number;
+  spawnFactor: number;
+  speedFactor: number;
+  minSpawnEveryMs: number;
+  maxSpeed: number;
+};
+
+export type WaveSpec = {
+  /** How many cats the wave brings. */
+  count: number;
+  /** Time between two arrivals, ms. */
+  spawnEveryMs: number;
+  /** How fast its cats chase the pointer, px/s. */
+  speed: number;
+};
+
+export const SURVIVAL_CONFIG: SurvivalConfig = {
+  lives: 3,
+  maxCats: CAT_CONFIG.maxCats,
+  hitRadius: 24,
+  clickRadius: CAT_CONFIG.catSize / 2,
+  keepAwayFromPointer: 240,
+  breakMs: 1500,
+  firstWave: { count: 3, spawnEveryMs: 1800, speed: 80 },
+  countStep: 1,
+  spawnFactor: 0.88,
+  speedFactor: 1.15,
+  minSpawnEveryMs: 350,
+  maxSpeed: 520,
+};
+
+/** What wave `n` (1-based) brings. */
+export function waveSpec(n: number, config: SurvivalConfig = SURVIVAL_CONFIG): WaveSpec {
+  const grown = Math.max(n, 1) - 1;
+  const { firstWave } = config;
+  return {
+    count: firstWave.count + grown * config.countStep,
+    spawnEveryMs: Math.max(
+      firstWave.spawnEveryMs * config.spawnFactor ** grown,
+      config.minSpawnEveryMs
+    ),
+    speed: Math.min(firstWave.speed * config.speedFactor ** grown, config.maxSpeed),
+  };
+}
+
+export type FightCat = {
+  id: number;
+  typeId: string;
+  /** The cat's centre, px. */
+  x: number;
+  y: number;
+  /** px/s. */
+  speed: number;
+};
+
+export type SurvivalStatus = 'playing' | 'over';
+
+export type SurvivalSnapshot = {
+  status: SurvivalStatus;
+  lives: number;
+  /** The wave under way (or about to start), 1-based. */
+  wave: number;
+  /** Waves survived so far: the score. */
+  score: number;
+  cats: readonly FightCat[];
+};
+
+export type Survival = ReturnType<typeof createSurvival>;
+
+export function createSurvival(options: {
+  random: Random;
+  types: readonly CatType[];
+  viewport: Size;
+  /** The game clock when it starts. */
+  now: number;
+  config?: Partial<SurvivalConfig>;
+}) {
+  const { random, types } = options;
+  const config: SurvivalConfig = { ...SURVIVAL_CONFIG, ...options.config };
+  let viewport = options.viewport;
+  let status: SurvivalStatus = 'playing';
+  let lives = config.lives;
+  let wave = 1;
+  let score = 0;
+  let spawned = 0;
+  let nextSpawnAt = options.now + config.breakMs;
+  let lastTick = options.now;
+  let cats: FightCat[] = [];
+  let nextId = 1;
+
+  /**
+   * A point just inside a random edge, away from the pointer; on a screen too small
+   * for that, the farthest edge point tried. Null only when there is no room at all.
+   */
+  function edgeSpot(pointer: Vec): Vec | null {
+    const inset = CAT_CONFIG.catSize / 2;
+    const { width, height } = viewport;
+    if (width < inset * 2 || height < inset * 2) return null;
+    let farthest: Vec | null = null;
+    let farthestDistance = -1;
+    for (let attempt = 0; attempt < 20; attempt++) {
+      const along = random.next();
+      const side = random.int(0, 3);
+      const spot =
+        side === 0
+          ? { x: inset + along * (width - 2 * inset), y: inset }
+          : side === 1
+            ? { x: width - inset, y: inset + along * (height - 2 * inset) }
+            : side === 2
+              ? { x: inset + along * (width - 2 * inset), y: height - inset }
+              : { x: inset, y: inset + along * (height - 2 * inset) };
+      const distance = Math.hypot(spot.x - pointer.x, spot.y - pointer.y);
+      if (distance >= config.keepAwayFromPointer) return spot;
+      if (distance > farthestDistance) {
+        farthest = spot;
+        farthestDistance = distance;
+      }
+    }
+    return farthest;
+  }
+
+  const snapshot = (): SurvivalSnapshot => ({
+    status,
+    lives,
+    wave,
+    score,
+    cats: cats.map((cat) => ({ ...cat })),
+  });
+
+  return {
+    config,
+
+    resize(size: Size) {
+      viewport = size;
+    },
+
+    snapshot,
+
+    /**
+     * Advances the game to `now`: spawns, moves every cat towards `pointer`, and
+     * lands the attacks of those that reach it. `room` caps the cats on screen
+     * below `maxCats` (other cats already there count against the limit).
+     * Returns the cats whose attack landed this tick, already removed.
+     */
+    tick(now: number, pointer: Vec, room: number = config.maxCats): FightCat[] {
+      if (status === 'over') return [];
+      const dt = Math.max(now - lastTick, 0) / 1000;
+      lastTick = now;
+      const spec = waveSpec(wave, config);
+      const limit = Math.min(config.maxCats, Math.max(room, 0));
+
+      // Arrivals that are due, one at a time, while there is room. A spawn that
+      // cannot happen yet (full screen, no spot) is retried on the next tick.
+      while (spawned < spec.count && now >= nextSpawnAt && cats.length < limit) {
+        const spot = edgeSpot(pointer);
+        if (!spot || types.length === 0) break;
+        cats.push({ id: nextId++, typeId: random.pick(types).id, ...spot, speed: spec.speed });
+        spawned++;
+        nextSpawnAt = now + spec.spawnEveryMs;
+      }
+
+      const landed: FightCat[] = [];
+      cats = cats.filter((cat) => {
+        const dx = pointer.x - cat.x;
+        const dy = pointer.y - cat.y;
+        const distance = Math.hypot(dx, dy);
+        const step = cat.speed * dt;
+        if (distance <= config.hitRadius + step) {
+          landed.push({ ...cat, x: pointer.x, y: pointer.y });
+          return false;
+        }
+        cat.x += (dx / distance) * step;
+        cat.y += (dy / distance) * step;
+        return true;
+      });
+
+      lives = Math.max(lives - landed.length, 0);
+      if (lives === 0) {
+        status = 'over';
+        cats = [];
+        return landed;
+      }
+
+      if (spawned >= spec.count && cats.length === 0) {
+        score++;
+        wave++;
+        spawned = 0;
+        nextSpawnAt = now + config.breakMs;
+      }
+      return landed;
+    },
+
+    /** A click at `point`: banishes the nearest cat within reach. Returns it, or null. */
+    click(point: Vec): FightCat | null {
+      if (status === 'over') return null;
+      let nearest: FightCat | null = null;
+      let best = config.clickRadius;
+      for (const cat of cats) {
+        const distance = Math.hypot(cat.x - point.x, cat.y - point.y);
+        if (distance <= best) {
+          best = distance;
+          nearest = cat;
+        }
+      }
+      if (nearest) cats = cats.filter((cat) => cat !== nearest);
+      return nearest;
+    },
+  };
+}
+
+/** Where the page keeps the best score (localStorage). */
+export const SURVIVAL_BEST_KEY = 'xenocats:survival-best';
+
+/** The best score after a game that scored `score`. */
+export const bestScore = (previous: number | null, score: number) => Math.max(previous ?? 0, score);
+
+/**
+ * Time that stops while the game is paused. `real` is any monotonic clock
+ * (performance.now()); `now` returns the game time it maps to.
+ */
+export function createGameClock(start: number) {
+  let offset = start;
+  let pausedAt: number | null = null;
+  return {
+    now(real: number): number {
+      return (pausedAt ?? real) - offset;
+    },
+    pause(real: number) {
+      pausedAt ??= real;
+    },
+    resume(real: number) {
+      if (pausedAt === null) return;
+      offset += real - pausedAt;
+      pausedAt = null;
+    },
+    isPaused(): boolean {
+      return pausedAt !== null;
+    },
+  };
+}
diff --git a/tests/e2e/cats.spec.ts b/tests/e2e/cats.spec.ts
index 2caabf1..323ce68 100644
--- a/tests/e2e/cats.spec.ts
+++ b/tests/e2e/cats.spec.ts
@@ -64,7 +64,7 @@ test('a cat summoned asleep naps in its asleep artwork, then wakes into its awak
   test.setTimeout(60_000); // the nap alone can last 22 s
   await openCats(page);
   await page.getByTestId('summon-asleep-void-tabby').click();
-  await expect(page.getByRole('status')).toHaveText(
+  await expect(page.getByTestId('summon-status')).toHaveText(
     'Void Tabby is on its way, and will nap before it pounces.'
   );
   const cat = page.getByTestId('xenocat');
@@ -92,7 +92,7 @@ test('Void Tabby makes the cursor vanish, and clicks are blocked meanwhile', asy
   await expect(fakeCursor(page)).toHaveCSS('opacity', '0');
 
   // A click during the effect does nothing: the status line does not change.
-  const status = page.getByRole('status');
+  const status = page.getByTestId('summon-status');
   const before = await status.textContent();
   await page.getByTestId('summon-gravi-coon').click({ force: true });
   await expect(status).toHaveText(before ?? '');
@@ -459,7 +459,7 @@ test('all 20 cats are on /cats, and a sixth summon is refused while five are on
   await expect(page.getByTestId('xenocat')).toHaveCount(5);
   await page.getByTestId('summon-hypno-rex').focus();
   await page.keyboard.press('Enter');
-  await expect(page.getByRole('status')).toHaveText(
+  await expect(page.getByTestId('summon-status')).toHaveText(
     'No room for another cat right now. Wait for one to leave.'
   );
   await expect(page.getByTestId('xenocat')).toHaveCount(5);
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
new file mode 100644
index 0000000..cf7dba9
--- /dev/null
+++ b/tests/e2e/fight.spec.ts
@@ -0,0 +1,106 @@
+import { type Page, expect, test } from '@playwright/test';
+import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
+
+// Fight a cat on /cats (no login, no database). These tests take the fallback path:
+// pointer lock is removed before the page loads, so the game runs with the fake
+// cursor and Playwright's mouse can play it.
+
+async function openFight(page: Page, best?: number) {
+  await page.addInitScript(
+    ({ key, best }) => {
+      Object.defineProperty(Element.prototype, 'requestPointerLock', {
+        value: undefined,
+        configurable: true,
+      });
+      if (best !== undefined) window.localStorage.setItem(key, String(best));
+    },
+    { key: SURVIVAL_BEST_KEY, best }
+  );
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await expect(page.getByRole('heading', { name: 'Fight a cat' })).toBeVisible();
+  // The fake cursor takes over on the first pointer move after hydration.
+  let nudge = 0;
+  await expect
+    .poll(async () => {
+      await page.mouse.move(640 + (nudge++ % 2), 400);
+      return page.locator('html').getAttribute('class');
+    })
+    .toContain('xenocat-cursor-hidden');
+}
+
+async function start(page: Page) {
+  await page.getByTestId('fight-start').click();
+  const overlay = page.getByTestId('fight-overlay');
+  await expect(overlay).toBeVisible();
+  await expect(overlay).toHaveAttribute('data-mode', 'fallback');
+  return overlay;
+}
+
+test('Survival: banishing every cat of a wave survives it; Esc ends the game and keeps the best score', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await openFight(page);
+  await expect(page.getByTestId('fight-best')).toHaveText('Best: no waves survived yet');
+  await start(page);
+  await expect(page.getByTestId('fight-lives')).toHaveText('Lives: 3');
+  await expect(page.getByTestId('fight-wave')).toHaveText('Wave 1');
+  // No cat can be summoned during a game.
+  await expect(page.getByTestId('summon-void-tabby')).toBeDisabled();
+
+  // Click every cat that shows up until wave 1 is over.
+  await expect
+    .poll(
+      async () => {
+        const cat = page.getByTestId('fight-cat').first();
+        const box = await cat.boundingBox().catch(() => null);
+        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
+        return page.getByTestId('fight-wave').getAttribute('data-wave');
+      },
+      { timeout: 40_000, intervals: [100] }
+    )
+    .toBe('2');
+  await expect(page.getByTestId('fight-score')).toHaveText('Survived: 1');
+
+  await page.keyboard.press('Escape');
+  await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
+  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
+    'Game over. You survived 1 wave. Best: 1.'
+  );
+  await expect(page.getByTestId('fight-best')).toHaveText('Best: 1 wave');
+  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('1');
+  await expect(page.getByTestId('summon-void-tabby')).toBeEnabled();
+  await expect(page.getByTestId('fight-start')).toHaveText('Play again');
+});
+
+test('Survival: a cat that reaches the pointer costs a life and attacks the cursor', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await openFight(page);
+  await start(page);
+  await page.mouse.move(640, 420);
+  // The first cat arrives after 1.5 s at least 240 px away and walks at 80 px/s.
+  // Two cats can land in the same moment, so this asserts a loss, not exactly one.
+  await expect
+    .poll(async () => Number(await page.getByTestId('fight-lives').getAttribute('data-lives')), {
+      timeout: 30_000,
+      intervals: [50],
+    })
+    .toBeLessThan(3);
+  await expect(page.getByTestId('fake-cursor')).not.toHaveAttribute('data-effect', '');
+});
+
+test('Survival: a lower score leaves the best score alone; End game stops it too', async ({
+  page,
+}) => {
+  await openFight(page, 7);
+  await expect(page.getByTestId('fight-best')).toHaveText('Best: 7 waves');
+  const overlay = await start(page);
+  await overlay.getByRole('button', { name: 'End game' }).click();
+  await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toHaveText(
+    'Game over. You survived 0 waves. Best: 7.'
+  );
+  expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('7');
+});
diff --git a/tests/unit/xenocats/locked-pointer.test.ts b/tests/unit/xenocats/locked-pointer.test.ts
new file mode 100644
index 0000000..33f0efb
--- /dev/null
+++ b/tests/unit/xenocats/locked-pointer.test.ts
@@ -0,0 +1,65 @@
+import { describe, expect, it } from 'vitest';
+import { KNOCKBACK_DISTANCE, heavy, knockback, vanish } from '@/app/ui/xenocats/effects';
+import { createLockedPointer } from '@/app/ui/xenocats/locked-pointer';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+const viewport = { width: 1200, height: 800 };
+
+const pointer = (start = { x: 600, y: 400 }) =>
+  createLockedPointer({ viewport, start, random: createRandom(1) });
+
+/** Frames every 16 ms from `from` to `to`. */
+function frames(p: ReturnType<typeof pointer>, from: number, to: number) {
+  for (let now = from; now <= to; now += 16) p.frame(now);
+}
+
+describe('the locked pointer', () => {
+  it('moves by the mouse’s movement, and stays on screen', () => {
+    const p = pointer();
+    p.move(30, -20);
+    p.frame(0);
+    expect(p.position()).toEqual({ x: 630, y: 380 });
+    p.move(5000, 5000);
+    p.frame(16);
+    expect(p.position()).toEqual({ x: 1199, y: 799 });
+  });
+
+  it('an attack moves the pointer itself: it stays where the effect left it', () => {
+    const p = pointer();
+    p.frame(0);
+    // A cat to the left knocks the pointer to the right.
+    expect(p.attack(knockback, { x: 500, y: 400 }, 0)).toBe(true);
+    frames(p, 0, knockback.durationMs + 100);
+    expect(p.activeEffectId(knockback.durationMs + 100)).toBeNull();
+    expect(p.position().x).toBeCloseTo(600 + KNOCKBACK_DISTANCE, 0);
+    // The mouse carries on from there, not from where it was before the attack.
+    p.move(10, 0);
+    p.frame(knockback.durationMs + 200);
+    expect(p.position().x).toBeCloseTo(600 + KNOCKBACK_DISTANCE + 10, 0);
+  });
+
+  it('a slowing attack leaves the pointer short of where the mouse went', () => {
+    const p = pointer();
+    p.frame(0);
+    p.attack(heavy, { x: 0, y: 0 }, 0);
+    for (let now = 16; now <= 1000; now += 16) {
+      p.move(10, 0);
+      p.frame(now);
+    }
+    frames(p, 1016, heavy.durationMs + 100);
+    const x = p.position().x;
+    expect(x).toBeLessThan(600 + 62 * 10);
+    expect(x).toBeGreaterThan(600);
+  });
+
+  it('only one effect at a time', () => {
+    const p = pointer();
+    p.frame(0);
+    expect(p.attack(vanish, { x: 0, y: 0 }, 0)).toBe(true);
+    expect(p.attack(knockback, { x: 0, y: 0 }, 100)).toBe(false);
+    expect(p.activeEffectId(100)).toBe('vanish');
+    expect(p.frame(100).visible).toBe(false);
+    frames(p, 116, vanish.durationMs + 50);
+    expect(p.frame(vanish.durationMs + 66).visible).toBe(true);
+  });
+});
diff --git a/tests/unit/xenocats/survival.test.ts b/tests/unit/xenocats/survival.test.ts
new file mode 100644
index 0000000..12cf74f
--- /dev/null
+++ b/tests/unit/xenocats/survival.test.ts
@@ -0,0 +1,203 @@
+import { describe, expect, it } from 'vitest';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { createRandom } from '@/app/ui/xenocats/random';
+import {
+  type FightCat,
+  SURVIVAL_CONFIG,
+  bestScore,
+  createGameClock,
+  createSurvival,
+  waveSpec,
+} from '@/app/ui/xenocats/survival';
+
+const viewport = { width: 1200, height: 800 };
+const centre = { x: 600, y: 400 };
+
+function game(seed = 1, config = {}) {
+  return createSurvival({ random: createRandom(seed), types: CAT_TYPES, viewport, now: 0, config });
+}
+
+/** Ticks every `step` ms from `from` to `to`; returns every cat whose attack landed. */
+function run(
+  g: ReturnType<typeof game>,
+  from: number,
+  to: number,
+  options: { pointer?: { x: number; y: number }; room?: number; each?: () => void } = {},
+  step = 20
+) {
+  const landed: FightCat[] = [];
+  for (let now = from; now <= to; now += step) {
+    landed.push(...g.tick(now, options.pointer ?? centre, options.room));
+    options.each?.();
+  }
+  return landed;
+}
+
+/** Clicks every cat on screen, every tick: nothing ever lands. */
+const banishAll = (g: ReturnType<typeof game>) => () => {
+  for (const cat of g.snapshot().cats) g.click(cat);
+};
+
+describe('waves', () => {
+  it('each wave brings more cats, sooner and faster', () => {
+    for (let n = 1; n < 12; n++) {
+      const now = waveSpec(n);
+      const next = waveSpec(n + 1);
+      expect(next.count).toBeGreaterThan(now.count);
+      expect(next.spawnEveryMs).toBeLessThanOrEqual(now.spawnEveryMs);
+      expect(next.speed).toBeGreaterThanOrEqual(now.speed);
+    }
+    expect(waveSpec(2).spawnEveryMs).toBeLessThan(waveSpec(1).spawnEveryMs);
+    expect(waveSpec(2).speed).toBeGreaterThan(waveSpec(1).speed);
+  });
+
+  it('speed and frequency stop growing at their limits', () => {
+    expect(waveSpec(200).spawnEveryMs).toBe(SURVIVAL_CONFIG.minSpawnEveryMs);
+    expect(waveSpec(200).speed).toBe(SURVIVAL_CONFIG.maxSpeed);
+  });
+
+  it('a wave is survived once all its cats have come and gone; the score counts them', () => {
+    const g = game();
+    run(g, 0, 60_000, { each: banishAll(g) });
+    const snap = g.snapshot();
+    expect(snap.status).toBe('playing');
+    expect(snap.lives).toBe(SURVIVAL_CONFIG.lives);
+    expect(snap.score).toBeGreaterThanOrEqual(3);
+    expect(snap.wave).toBe(snap.score + 1);
+  });
+
+  it('brings exactly the wave’s number of cats', () => {
+    const g = game();
+    const seen = new Set<number>();
+    run(g, 0, 30_000, {
+      each: () => {
+        if (g.snapshot().wave > 1) return;
+        for (const cat of g.snapshot().cats) seen.add(cat.id);
+        banishAll(g)();
+      },
+    });
+    expect(g.snapshot().wave).toBeGreaterThan(1);
+    expect(seen.size).toBe(waveSpec(1).count);
+  });
+});
+
+describe('never more than five cats', () => {
+  it('stays at five or fewer, however long the cats chase', () => {
+    // Cats that never arrive (a pointer they cannot reach in time) pile up.
+    const g = game(3, { firstWave: { count: 40, spawnEveryMs: 50, speed: 1 } });
+    let most = 0;
+    run(g, 0, 20_000, { each: () => (most = Math.max(most, g.snapshot().cats.length)) });
+    expect(most).toBe(5);
+  });
+
+  it('leaves room for cats that are already on screen', () => {
+    const g = game(3, { firstWave: { count: 40, spawnEveryMs: 50, speed: 1 } });
+    let most = 0;
+    run(g, 0, 20_000, {
+      room: 2,
+      each: () => (most = Math.max(most, g.snapshot().cats.length)),
+    });
+    expect(most).toBe(2);
+  });
+});
+
+describe('attacks and lives', () => {
+  it('cats arrive at an edge, away from the pointer, and chase it', () => {
+    const g = game();
+    run(g, 0, SURVIVAL_CONFIG.breakMs);
+    const [cat] = g.snapshot().cats;
+    expect(cat).toBeDefined();
+    const distance = (c: { x: number; y: number }) => Math.hypot(c.x - centre.x, c.y - centre.y);
+    expect(distance(cat)).toBeGreaterThanOrEqual(SURVIVAL_CONFIG.keepAwayFromPointer);
+    run(g, SURVIVAL_CONFIG.breakMs + 20, SURVIVAL_CONFIG.breakMs + 1000);
+    const later = g.snapshot().cats.find((c) => c.id === cat.id)!;
+    expect(distance(later)).toBeLessThan(distance(cat));
+  });
+
+  it('cats still arrive on a screen too small to keep their distance', () => {
+    const small = createSurvival({
+      random: createRandom(1),
+      types: CAT_TYPES,
+      viewport: { width: 400, height: 400 },
+      now: 0,
+    });
+    for (let now = 0; now <= SURVIVAL_CONFIG.breakMs; now += 20)
+      small.tick(now, { x: 200, y: 200 });
+    expect(small.snapshot().cats).toHaveLength(1);
+  });
+
+  it('a cat that reaches the pointer lands its attack, leaves, and costs a life', () => {
+    const g = game();
+    const landed = run(g, 0, 20_000);
+    expect(landed.length).toBeGreaterThan(0);
+    const first = landed[0];
+    expect(first).toMatchObject(centre);
+    expect(g.snapshot().cats.find((c) => c.id === first.id)).toBeUndefined();
+  });
+
+  it('three landed attacks end the game; the score is the waves survived', () => {
+    const g = game();
+    const landed = run(g, 0, 60_000);
+    const snap = g.snapshot();
+    expect(landed).toHaveLength(SURVIVAL_CONFIG.lives);
+    expect(snap.status).toBe('over');
+    expect(snap.lives).toBe(0);
+    expect(snap.cats).toHaveLength(0);
+    expect(snap.score).toBe(0);
+    // Nothing more happens once it is over.
+    expect(g.tick(70_000, centre)).toEqual([]);
+    expect(g.click(centre)).toBeNull();
+  });
+});
+
+describe('clicking', () => {
+  it('banishes the cat under the click, and only that one', () => {
+    const g = game(5, { firstWave: { count: 2, spawnEveryMs: 10, speed: 1 } });
+    run(g, 0, SURVIVAL_CONFIG.breakMs + SURVIVAL_CONFIG.minSpawnEveryMs + 20);
+    const [a, b] = g.snapshot().cats;
+    expect(b).toBeDefined();
+    expect(g.click({ x: a.x + 10, y: a.y - 10 })).toMatchObject({ id: a.id });
+    expect(g.snapshot().cats.map((c) => c.id)).toEqual([b.id]);
+  });
+
+  it('misses a cat further away than its reach', () => {
+    const g = game(5, { firstWave: { count: 1, spawnEveryMs: 10, speed: 1 } });
+    run(g, 0, SURVIVAL_CONFIG.breakMs + 20);
+    const [cat] = g.snapshot().cats;
+    expect(g.click({ x: cat.x + SURVIVAL_CONFIG.clickRadius + 1, y: cat.y })).toBeNull();
+    expect(g.snapshot().cats).toHaveLength(1);
+  });
+});
+
+describe('best score', () => {
+  it('keeps the higher of the old best and the new score', () => {
+    expect(bestScore(null, 0)).toBe(0);
+    expect(bestScore(null, 4)).toBe(4);
+    expect(bestScore(6, 4)).toBe(6);
+    expect(bestScore(6, 9)).toBe(9);
+  });
+});
+
+describe('game clock', () => {
+  it('stands still while paused', () => {
+    const clock = createGameClock(1000);
+    expect(clock.now(1500)).toBe(500);
+    clock.pause(1500);
+    expect(clock.isPaused()).toBe(true);
+    expect(clock.now(9000)).toBe(500);
+    clock.resume(9000);
+    expect(clock.isPaused()).toBe(false);
+    expect(clock.now(9100)).toBe(600);
+  });
+
+  it('a paused game does not move on: no cat comes closer', () => {
+    const g = game();
+    const clock = createGameClock(0);
+    for (let real = 0; real <= 2000; real += 20) g.tick(clock.now(real), centre);
+    const before = g.snapshot().cats;
+    clock.pause(2000);
+    for (let real = 2000; real <= 30_000; real += 20) g.tick(clock.now(real), centre);
+    expect(g.snapshot().cats).toEqual(before);
+    expect(g.snapshot().lives).toBe(SURVIVAL_CONFIG.lives);
+  });
+});
~~~~

</details>

#### T2 — `night-2026-10-01-t2-taming`

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

<details><summary>Code:  5 files changed, 909 insertions(+), 60 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index 3aa50c1..fce9345 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -19,22 +19,60 @@ import {
   createGameClock,
   createSurvival,
 } from './survival';
+import {
+  TAMED_KEY,
+  type Taming,
+  type TamingSnapshot,
+  addTamed,
+  createTaming,
+  parseCollection,
+} from './taming';
 
 // Fight a cat, on the /cats page. Start asks for pointer lock: the browser hides the
 // system pointer and the game owns the pointer's position, so the cats attack that
 // pointer itself (locked-pointer.ts). Esc releases the lock and ends the game;
 // losing it any other way (another tab, another window) pauses it. Where pointer
 // lock is refused or missing, the game runs with the page's fake cursor instead.
+//
+// Two games: Survival (survival.ts) and Taming (taming.ts), where one cat at a time
+// dodges the pointer and holding still on it for 2 s tames it, into a collection
+// kept in localStorage.
 
 type Mode = 'locked' | 'fallback';
 type Phase = 'idle' | 'playing' | 'paused' | 'over';
+type Kind = 'survival' | 'taming';
 
 type Game = {
-  survival: Survival;
   clock: ReturnType<typeof createGameClock>;
   mode: Mode;
   pointer: LockedPointer | null;
-};
+} & ({ kind: 'survival'; survival: Survival } | { kind: 'taming'; taming: Taming });
+
+const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
+
+function readCollectionRaw(): string | null {
+  try {
+    return window.localStorage.getItem(TAMED_KEY);
+  } catch {
+    return null;
+  }
+}
+
+/** How many cats have been tamed in all, from localStorage. */
+function readTamedTotal(): number {
+  const collection = parseCollection(readCollectionRaw(), CAT_TYPES);
+  return Object.values(collection).reduce((sum, count) => sum + count, 0);
+}
+
+/** Adds a tamed cat to the stored collection. */
+function storeTamed(typeId: string) {
+  try {
+    const collection = parseCollection(readCollectionRaw(), CAT_TYPES);
+    window.localStorage.setItem(TAMED_KEY, JSON.stringify(addTamed(collection, typeId)));
+  } catch {
+    // Storage blocked or full: the cat is tamed for this game only.
+  }
+}
 
 function readBest(): number | null {
   try {
@@ -99,6 +137,12 @@ function requestLock(): Promise<boolean> {
   });
 }
 
+/** Puts a cat's element so the cat is centred on `at`. */
+function placeCat(element: HTMLElement, at: Vec) {
+  element.style.left = `${at.x - CAT_CONFIG.catSize / 2}px`;
+  element.style.top = `${at.y - CAT_CONFIG.catSize / 2}px`;
+}
+
 const viewportSize = () => ({ width: window.innerWidth, height: window.innerHeight });
 
 export default function Fight({
@@ -111,9 +155,12 @@ export default function Fight({
   const cats = useXenocats();
   const [phase, setPhase] = useState<Phase>('idle');
   const [mode, setMode] = useState<Mode>('fallback');
+  const [kind, setKind] = useState<Kind>('survival');
   const [snap, setSnap] = useState<SurvivalSnapshot | null>(null);
-  // Read on every render, so the best a game just wrote shows at once.
+  const [tameSnap, setTameSnap] = useState<TamingSnapshot | null>(null);
+  // Read on every render, so what a game just wrote shows at once.
   const best = useSyncExternalStore(subscribeBest, readBest, () => null);
+  const tamedTotal = useSyncExternalStore(subscribeBest, readTamedTotal, () => 0);
   const [message, setMessage] = useState('');
   const gameRef = useRef<Game | null>(null);
   const phaseRef = useRef<Phase>('idle');
@@ -121,6 +168,9 @@ export default function Fight({
   const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
   const startRef = useRef<HTMLDivElement>(null);
   const dialogRef = useRef<HTMLDivElement>(null);
+  // Cats move every frame, so the loop moves their elements itself; React renders
+  // only when what it shows changes (a cat comes or goes, a life, a wave, the hold).
+  const shownRef = useRef('');
   // Set from Start until the game begins: asking for the lock can take a second.
   const startingRef = useRef(false);
 
@@ -136,14 +186,18 @@ export default function Fight({
   const finish = useCallback(() => {
     const game = gameRef.current;
     if (!game || phaseRef.current === 'over' || phaseRef.current === 'idle') return;
-    const final = game.survival.snapshot();
-    const kept = bestScore(readBest(), final.score);
-    writeBest(kept);
-    setSnap(final);
     if (document.pointerLockElement) document.exitPointerLock();
     cursor.hide(false);
-    const waves = final.score === 1 ? '1 wave' : `${final.score} waves`;
-    setMessage(`Game over. You survived ${waves}. Best: ${kept}.`);
+    if (game.kind === 'survival') {
+      const final = game.survival.snapshot();
+      const kept = bestScore(readBest(), final.score);
+      writeBest(kept);
+      setSnap(final);
+      setMessage(`Game over. You survived ${plural(final.score, 'wave', 'waves')}. Best: ${kept}.`);
+    } else {
+      const tamed = game.taming.snapshot(game.clock.now(performance.now())).tamed.length;
+      setMessage(`Taming over. You tamed ${plural(tamed, 'cat', 'cats')}.`);
+    }
     changePhase('over');
   }, [cursor, changePhase]);
 
@@ -156,20 +210,24 @@ export default function Fight({
     changePhase('paused');
   }, [cursor, changePhase]);
 
-  const begin = (mode: Mode, game: Game) => {
+  const begin = (game: Game) => {
     gameRef.current = game;
-    setMode(mode);
-    setSnap(game.survival.snapshot());
-    cursor.hide(mode === 'locked');
+    shownRef.current = '';
+    setMode(game.mode);
+    setKind(game.kind);
+    if (game.kind === 'survival') setSnap(game.survival.snapshot());
+    else setTameSnap(game.taming.snapshot(0));
+    cursor.hide(game.mode === 'locked');
+    const stop = game.mode === 'locked' ? 'Press Esc to stop.' : 'Press Esc or End game to stop.';
     setMessage(
-      mode === 'locked'
-        ? 'The cats are coming. Press Esc to stop.'
-        : 'The cats are coming. Press Esc or End game to stop.'
+      game.kind === 'survival'
+        ? `The cats are coming. ${stop}`
+        : `Keep still and a cat will come. Hold still on it to tame it. ${stop}`
     );
     changePhase('playing');
   };
 
-  const start = async () => {
+  const start = async (kind: Kind) => {
     if (startingRef.current || phaseRef.current === 'playing' || phaseRef.current === 'paused') {
       return;
     }
@@ -178,13 +236,17 @@ export default function Fight({
     startingRef.current = false;
     const viewport = viewportSize();
     const at: Vec = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
-    const clock = createGameClock(performance.now());
-    begin(locked ? 'locked' : 'fallback', {
-      survival: createSurvival({ random: cursor.random, types: CAT_TYPES, viewport, now: 0 }),
-      clock,
-      mode: locked ? 'locked' : 'fallback',
+    const common = {
+      clock: createGameClock(performance.now()),
+      mode: (locked ? 'locked' : 'fallback') as Mode,
       pointer: locked ? createLockedPointer({ viewport, start: at, random: cursor.random }) : null,
-    });
+    };
+    const options = { random: cursor.random, types: CAT_TYPES, viewport, now: 0 };
+    begin(
+      kind === 'survival'
+        ? { ...common, kind, survival: createSurvival(options) }
+        : { ...common, kind, taming: createTaming(options) }
+    );
   };
 
   const resume = async () => {
@@ -215,6 +277,14 @@ export default function Fight({
     const game = gameRef.current;
     if (!game) return;
 
+    const moveCats = (list: readonly { id: number; x: number; y: number }[]) => {
+      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
+      for (const element of elements) {
+        const cat = list.find((c) => String(c.id) === element.dataset.catId);
+        if (cat) placeCat(element, cat);
+      }
+    };
+
     let frameId = 0;
     const loop = () => {
       if (phaseRef.current === 'playing') {
@@ -235,19 +305,42 @@ export default function Fight({
           const viewport = viewportSize();
           at = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
         }
-        const landed = game.survival.tick(now, at, CAT_CONFIG.maxCats - cats.count());
-        for (const cat of landed) {
-          const type = catTypeById(cat.typeId);
-          if (!type) continue;
-          // Only one effect at a time: a cat landing during another's still costs a life.
-          if (game.mode === 'locked' && game.pointer) game.pointer.attack(type.effect, cat, now);
-          else cursor.attack(type.effect, cat);
-        }
-        const snapshot = game.survival.snapshot();
-        setSnap(snapshot);
-        if (snapshot.status === 'over') {
-          finish();
-          return;
+        if (game.kind === 'taming') {
+          const tamed = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
+          if (tamed) {
+            storeTamed(tamed);
+            setMessage(`You tamed ${catTypeById(tamed)?.name ?? 'a cat'}!`);
+          }
+          const snapshot = game.taming.snapshot(now);
+          moveCats(snapshot.cat ? [snapshot.cat] : []);
+          const { cat, hold } = snapshot;
+          const key = `${cat?.id}|${cat?.doing}|${Math.round(hold * 50)}|${snapshot.tamed.length}`;
+          if (key !== shownRef.current) {
+            shownRef.current = key;
+            setTameSnap(snapshot);
+          }
+        } else {
+          const landed = game.survival.tick(now, at, CAT_CONFIG.maxCats - cats.count());
+          for (const cat of landed) {
+            const type = catTypeById(cat.typeId);
+            if (!type) continue;
+            // One effect at a time: a cat landing during another's still costs a life.
+            if (game.mode === 'locked' && game.pointer) game.pointer.attack(type.effect, cat, now);
+            else cursor.attack(type.effect, cat);
+          }
+          const snapshot = game.survival.snapshot();
+          moveCats(snapshot.cats);
+          const { status, lives, wave, score } = snapshot;
+          const ids = snapshot.cats.map((cat) => cat.id).join(',');
+          const key = `${status}|${lives}|${wave}|${score}|${ids}`;
+          if (key !== shownRef.current) {
+            shownRef.current = key;
+            setSnap(snapshot);
+          }
+          if (snapshot.status === 'over') {
+            finish();
+            return;
+          }
         }
       }
       frameId = requestAnimationFrame(loop);
@@ -261,7 +354,7 @@ export default function Fight({
     };
     const onMouseDown = (event: MouseEvent) => {
       if (phaseRef.current !== 'playing' || event.button !== 0 || !game.pointer) return;
-      if (document.pointerLockElement !== document.body) return;
+      if (game.kind !== 'survival' || document.pointerLockElement !== document.body) return;
       // Clicks are blocked while an effect runs, as they are for the fake cursor.
       if (game.pointer.activeEffectId(game.clock.now(performance.now())) !== null) return;
       if (game.survival.click(game.pointer.position())) setSnap(game.survival.snapshot());
@@ -284,7 +377,8 @@ export default function Fight({
       if (document.visibilityState === 'hidden') pause();
     };
     const onResize = () => {
-      game.survival.resize(viewportSize());
+      if (game.kind === 'survival') game.survival.resize(viewportSize());
+      else game.taming.resize(viewportSize());
       game.pointer?.resize(viewportSize());
     };
 
@@ -321,7 +415,7 @@ export default function Fight({
   const onOverlayPointerDown = (event: React.PointerEvent) => {
     const game = gameRef.current;
     if (!game || game.mode !== 'fallback' || phaseRef.current !== 'playing') return;
-    if (event.button !== 0) return;
+    if (game.kind !== 'survival' || event.button !== 0) return;
     if (game.survival.click({ x: event.clientX, y: event.clientY })) {
       setSnap(game.survival.snapshot());
     }
@@ -340,44 +434,81 @@ export default function Fight({
       <p className="mt-2 max-w-2xl text-sm text-aura">
         <span className="font-semibold text-white">Survival.</span> Cats come in waves, faster and
         more often each time. Click a cat to banish it; every cat that reaches your pointer costs
-        one of 3 lives. Your pointer is locked to the game until you press Esc.
+        one of 3 lives.
+      </p>
+      <p className="mt-2 max-w-2xl text-sm text-aura">
+        <span className="font-semibold text-white">Taming.</span> One cat at a time, and it dodges
+        your pointer, each kind in its own way. Keep still and it gets curious; hold your pointer
+        still on it for 2 seconds to tame it.
+      </p>
+      <p className="mt-2 max-w-2xl text-sm text-aura">
+        Your pointer is locked to the game until you press Esc.
       </p>
       <div ref={startRef} className="mt-4 flex flex-wrap items-center gap-4">
-        <Button data-testid="fight-start" onClick={start} disabled={running}>
-          {phase === 'over' ? 'Play again' : 'Start Survival'}
+        <Button data-testid="fight-start" onClick={() => start('survival')} disabled={running}>
+          {phase === 'over' && kind === 'survival' ? 'Play again' : 'Start Survival'}
+        </Button>
+        <Button data-testid="fight-start-taming" onClick={() => start('taming')} disabled={running}>
+          {phase === 'over' && kind === 'taming' ? 'Tame again' : 'Start Taming'}
         </Button>
         <p data-testid="fight-best" className="text-sm text-aura">
           Best:{' '}
           {best === null ? 'no waves survived yet' : `${best} ${best === 1 ? 'wave' : 'waves'}`}
         </p>
+        <p data-testid="fight-tamed" className="text-sm text-aura">
+          Tamed: {plural(tamedTotal, 'cat', 'cats')}
+        </p>
       </div>
       <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-plasma">
         {phase === 'over' ? message : ''}
       </p>
 
       {running &&
-        snap &&
+        (kind === 'survival' ? snap : tameSnap) &&
         createPortal(
           <div
             ref={dialogRef}
             role="dialog"
             aria-modal="true"
-            aria-label="Fight a cat: Survival"
+            aria-label={kind === 'survival' ? 'Fight a cat: Survival' : 'Fight a cat: Taming'}
             tabIndex={-1}
             data-testid="fight-overlay"
             data-mode={mode}
+            data-kind={kind}
             data-phase={phase}
             onPointerDown={onOverlayPointerDown}
             className="fixed inset-0 z-[9998] select-none bg-void/85 outline-none"
           >
             <div className="flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
-              <p data-testid="fight-lives" data-lives={snap.lives}>
-                Lives: {snap.lives}
-              </p>
-              <p data-testid="fight-wave" data-wave={snap.wave}>
-                Wave {snap.wave}
-              </p>
-              <p data-testid="fight-score">Survived: {snap.score}</p>
+              {kind === 'survival' && snap && (
+                <>
+                  <p data-testid="fight-lives" data-lives={snap.lives}>
+                    Lives: {snap.lives}
+                  </p>
+                  <p data-testid="fight-wave" data-wave={snap.wave}>
+                    Wave {snap.wave}
+                  </p>
+                  <p data-testid="fight-score">Survived: {snap.score}</p>
+                </>
+              )}
+              {kind === 'taming' && tameSnap && (
+                <>
+                  <p data-testid="fight-tamed-now">Tamed this game: {tameSnap.tamed.length}</p>
+                  <div
+                    role="progressbar"
+                    aria-label="Taming"
+                    aria-valuemin={0}
+                    aria-valuemax={100}
+                    aria-valuenow={Math.round(tameSnap.hold * 100)}
+                    className="h-2 w-32 overflow-hidden rounded-full bg-void"
+                  >
+                    <div
+                      className="h-full bg-plasma"
+                      style={{ width: `${tameSnap.hold * 100}%` }}
+                    />
+                  </div>
+                </>
+              )}
               <p role="status" className="text-plasma">
                 {message}
               </p>
@@ -389,22 +520,49 @@ export default function Fight({
             </div>
 
             <div aria-hidden="true">
-              {snap.cats.map((cat) => (
+              {kind === 'taming' && tameSnap?.cat && (
                 <div
-                  key={cat.id}
+                  key={tameSnap.cat.id}
+                  data-cat-id={tameSnap.cat.id}
                   data-testid="fight-cat"
-                  data-cat-type={cat.typeId}
-                  className="absolute"
+                  data-cat-type={tameSnap.cat.typeId}
+                  data-doing={tameSnap.cat.doing}
+                  className="absolute rounded-full"
                   style={{
-                    left: cat.x - size / 2,
-                    top: cat.y - size / 2,
+                    // Where the cat was when React last drew it; the loop moves it on.
+                    left: tameSnap.cat.x - size / 2,
+                    top: tameSnap.cat.y - size / 2,
                     width: size,
                     height: size,
+                    // A blinking cat is gone for a moment; a held one glows as it calms.
+                    opacity: tameSnap.cat.doing === 'blink' ? 0.15 : 1,
+                    boxShadow:
+                      tameSnap.hold > 0
+                        ? `0 0 0 3px rgba(255, 255, 255, ${0.2 + tameSnap.hold * 0.6})`
+                        : undefined,
                   }}
                 >
-                  <FightCatSprite typeId={cat.typeId} size={size} />
+                  <FightCatSprite typeId={tameSnap.cat.typeId} size={size} />
                 </div>
-              ))}
+              )}
+              {kind === 'survival' &&
+                snap?.cats.map((cat) => (
+                  <div
+                    key={cat.id}
+                    data-cat-id={cat.id}
+                    data-testid="fight-cat"
+                    data-cat-type={cat.typeId}
+                    className="absolute"
+                    style={{
+                      left: cat.x - size / 2,
+                      top: cat.y - size / 2,
+                      width: size,
+                      height: size,
+                    }}
+                  >
+                    <FightCatSprite typeId={cat.typeId} size={size} />
+                  </div>
+                ))}
             </div>
 
             {phase === 'paused' && (
diff --git a/app/ui/xenocats/taming.ts b/app/ui/xenocats/taming.ts
new file mode 100644
index 0000000..3561229
--- /dev/null
+++ b/app/ui/xenocats/taming.ts
@@ -0,0 +1,394 @@
+// Fight a cat, Taming mode, as a pure state machine (time and pointer passed in).
+//
+// One cat at a time wanders the screen. A pointer moving near it makes it dodge, each
+// cat type in its own way, derived from its attack (DODGES). A pointer that keeps
+// still makes it curious: it walks over and stops beneath it. Holding the pointer
+// still on a cat for 2 s tames it, and the next cat comes.
+
+import type { CatType } from './cat-types';
+import { CAT_CONFIG } from './config';
+import { type Size, type Vec, clampToViewport } from './effects';
+import type { Random } from './random';
+
+export type DodgeKind =
+  /** Runs straight away from the pointer. */
+  | 'dash'
+  /** Vanishes and reappears somewhere else, at least `distance` from the pointer. */
+  | 'blink'
+  /** Steps aside, at right angles to the pointer. */
+  | 'sidestep'
+  /** Hops a short way in a random direction, away rather than towards. */
+  | 'hop'
+  /** Circles round the pointer by `distance` radians, a little further out. */
+  | 'circle'
+  /** Jumps to the mirror image of where it was, through the pointer. */
+  | 'mirror'
+  /** Drops straight down. */
+  | 'drop'
+  /** Moves away along one axis only, the one it is further along. */
+  | 'axis';
+
+export type Dodge = {
+  kind: DodgeKind;
+  /** px; radians for `circle`. */
+  distance: number;
+  /** How long the dodge takes, ms. */
+  durationMs: number;
+  /** How long the cat takes to notice the pointer before it dodges, ms. */
+  reactMs: number;
+};
+
+const dodge = (kind: DodgeKind, distance: number, durationMs: number, reactMs = 0): Dodge => ({
+  kind,
+  distance,
+  durationMs,
+  reactMs,
+});
+
+/** Each attack's way of dodging, keyed by effect id. */
+export const DODGES: Readonly<Record<string, Dodge>> = {
+  // Void Tabby vanishes; Quantum Kitten teleports; Decoy Burmese and Smoke Bombay
+  // slip away behind a decoy or a puff of smoke.
+  vanish: dodge('blink', 260, 150),
+  teleport: dodge('blink', 400, 60),
+  decoys: dodge('blink', 200, 220),
+  blur: dodge('blink', 160, 320),
+  // Knockback and magnet push; the heavy and the giant lumber off; the lagging one
+  // runs, but late.
+  knockback: dodge('dash', 320, 250),
+  magnet: dodge('dash', 200, 420),
+  heavy: dodge('dash', 90, 900),
+  giant: dodge('dash', 220, 700),
+  delay: dodge('dash', 180, 400, 800),
+  bounce: dodge('dash', 280, 300),
+  // Static and drunk cats hop about; the tiny one in tiny hops.
+  jitter: dodge('hop', 70, 120),
+  drunk: dodge('hop', 120, 520),
+  tiny: dodge('hop', 40, 100),
+  // The cold one steps aside, slowly.
+  freeze: dodge('sidestep', 70, 750),
+  // Drifters, orbiters and spirals circle round the pointer.
+  drift: dodge('circle', 0.8, 1200),
+  orbit: dodge('circle', 1.6, 600),
+  spiral: dodge('circle', 2.4, 900),
+  reverse: dodge('mirror', 0, 300),
+  fall: dodge('drop', 220, 450),
+  'axis-lock': dodge('axis', 240, 260),
+};
+
+/** A cat type's dodge; a plain dash for an attack DODGES does not know. */
+export const dodgeFor = (type: CatType): Dodge => DODGES[type.effect.id] ?? dodge('dash', 200, 400);
+
+/**
+ * Where a cat at `cat` dodges to from a pointer at `pointer`, on screen. Pure:
+ * anything random comes from `random`.
+ */
+export function dodgeTarget(
+  style: Dodge,
+  cat: Vec,
+  pointer: Vec,
+  viewport: Size,
+  random: Random
+): Vec {
+  const inset = CAT_CONFIG.catSize / 2;
+  const keep = (point: Vec) =>
+    clampToViewport(
+      {
+        x: Math.min(Math.max(point.x, inset), viewport.width - inset),
+        y: Math.min(Math.max(point.y, inset), viewport.height - inset),
+      },
+      viewport
+    );
+  const dx = cat.x - pointer.x;
+  const dy = cat.y - pointer.y;
+  const length = Math.hypot(dx, dy);
+  // Away from the pointer; any direction if it is right on top of the cat.
+  const angle = length < 1e-6 ? random.next() * 2 * Math.PI : Math.atan2(dy, dx);
+  const away = { x: Math.cos(angle), y: Math.sin(angle) };
+  const { distance } = style;
+
+  switch (style.kind) {
+    case 'dash':
+      return keep({ x: cat.x + away.x * distance, y: cat.y + away.y * distance });
+    case 'blink': {
+      for (let attempt = 0; attempt < 20; attempt++) {
+        const spot = keep({
+          x: random.range(inset, viewport.width - inset),
+          y: random.range(inset, viewport.height - inset),
+        });
+        if (Math.hypot(spot.x - pointer.x, spot.y - pointer.y) >= distance) return spot;
+      }
+      return keep({ x: cat.x + away.x * distance, y: cat.y + away.y * distance });
+    }
+    case 'sidestep': {
+      const side = random.next() < 0.5 ? 1 : -1;
+      return keep({ x: cat.x - away.y * side * distance, y: cat.y + away.x * side * distance });
+    }
+    case 'hop': {
+      // Within a half-circle facing away from the pointer.
+      const turn = angle + (random.next() - 0.5) * Math.PI;
+      return keep({ x: cat.x + Math.cos(turn) * distance, y: cat.y + Math.sin(turn) * distance });
+    }
+    case 'circle': {
+      const radius = Math.max(length, inset) + 40;
+      const turn = angle + (random.next() < 0.5 ? 1 : -1) * distance;
+      return keep({
+        x: pointer.x + Math.cos(turn) * radius,
+        y: pointer.y + Math.sin(turn) * radius,
+      });
+    }
+    case 'mirror':
+      return keep({ x: pointer.x - dx, y: pointer.y - dy });
+    case 'drop':
+      return keep({ x: cat.x, y: cat.y + distance });
+    case 'axis':
+      return Math.abs(dx) >= Math.abs(dy)
+        ? keep({ x: cat.x + Math.sign(dx || 1) * distance, y: cat.y })
+        : keep({ x: cat.x, y: cat.y + Math.sign(dy || 1) * distance });
+  }
+}
+
+export type TamingConfig = {
+  /** Holding still on a cat this long tames it, ms. */
+  tameMs: number;
+  /** The pointer is on the cat within this distance of its centre, px. */
+  catchRadius: number;
+  /** A pointer that moves within this distance of the cat makes it dodge, px. */
+  noticeRadius: number;
+  /** A pointer is still while it stays within this distance, px. */
+  stillPx: number;
+  /** A pointer still this long makes the cat curious: it walks over, ms. */
+  curiousAfterMs: number;
+  /** How fast a wandering or curious cat walks, px/s. */
+  walkSpeed: number;
+  /** After a dodge the cat ignores the pointer this long, so it can be approached, ms. */
+  calmMs: number;
+  /** The pause before the next cat, ms. */
+  breakMs: number;
+  /** A new cat appears at least this far from the pointer, px. */
+  keepAwayFromPointer: number;
+};
+
+export const TAMING_CONFIG: TamingConfig = {
+  tameMs: 2000,
+  catchRadius: CAT_CONFIG.catSize / 2,
+  noticeRadius: 140,
+  stillPx: 6,
+  curiousAfterMs: 1000,
+  walkSpeed: 110,
+  calmMs: 500,
+  breakMs: 1200,
+  keepAwayFromPointer: 240,
+};
+
+export type TamingCat = {
+  id: number;
+  typeId: string;
+  /** Centre, px. */
+  x: number;
+  y: number;
+  /** What it is doing: a dodge's kind while dodging. */
+  doing: 'wandering' | 'curious' | 'held' | DodgeKind;
+};
+
+export type TamingSnapshot = {
+  cat: TamingCat | null;
+  /** How far along the 2 s hold is, 0–1. */
+  hold: number;
+  /** Type ids tamed this game, in order. */
+  tamed: readonly string[];
+};
+
+type Motion = { from: Vec; to: Vec; startsAt: number; endsAt: number; kind: DodgeKind };
+
+export type Taming = ReturnType<typeof createTaming>;
+
+export function createTaming(options: {
+  random: Random;
+  types: readonly CatType[];
+  viewport: Size;
+  now: number;
+  config?: Partial<TamingConfig>;
+}) {
+  const { random, types } = options;
+  const config: TamingConfig = { ...TAMING_CONFIG, ...options.config };
+  let viewport = options.viewport;
+  let cat: (TamingCat & { type: CatType }) | null = null;
+  let nextCatAt = options.now + config.breakMs;
+  let nextId = 1;
+  let lastTick = options.now;
+  let motion: Motion | null = null;
+  let calmUntil = -Infinity;
+  let wanderTo: Vec | null = null;
+  /** Where the pointer has been keeping still, and since when. */
+  let still: { at: Vec; since: number } | null = null;
+  let holdSince: number | null = null;
+  let tamed: string[] = [];
+
+  const inset = CAT_CONFIG.catSize / 2;
+  const randomSpot = (): Vec => ({
+    x: random.range(inset, Math.max(viewport.width - inset, inset + 1)),
+    y: random.range(inset, Math.max(viewport.height - inset, inset + 1)),
+  });
+
+  function spawn(pointer: Vec) {
+    let spot = randomSpot();
+    for (let attempt = 0; attempt < 20; attempt++) {
+      if (Math.hypot(spot.x - pointer.x, spot.y - pointer.y) >= config.keepAwayFromPointer) break;
+      spot = randomSpot();
+    }
+    const type = random.pick(types);
+    cat = { id: nextId++, typeId: type.id, type, ...spot, doing: 'wandering' };
+    motion = null;
+    wanderTo = null;
+    holdSince = null;
+    calmUntil = -Infinity;
+  }
+
+  /** Walks the cat towards `to` for `dt` seconds; true once it is there. */
+  function walk(to: Vec, dt: number): boolean {
+    if (!cat) return true;
+    const dx = to.x - cat.x;
+    const dy = to.y - cat.y;
+    const distance = Math.hypot(dx, dy);
+    const step = config.walkSpeed * dt;
+    if (distance <= step) {
+      cat.x = to.x;
+      cat.y = to.y;
+      return true;
+    }
+    cat.x += (dx / distance) * step;
+    cat.y += (dy / distance) * step;
+    return false;
+  }
+
+  const holdProgress = (now: number) =>
+    holdSince === null ? 0 : Math.min((now - holdSince) / config.tameMs, 1);
+
+  return {
+    config,
+
+    resize(size: Size) {
+      viewport = size;
+    },
+
+    snapshot(now: number): TamingSnapshot {
+      return {
+        cat: cat ? { id: cat.id, typeId: cat.typeId, x: cat.x, y: cat.y, doing: cat.doing } : null,
+        hold: holdProgress(now),
+        tamed: [...tamed],
+      };
+    },
+
+    /**
+     * Advances to `now`. `room` is how many more cats the screen may hold (others
+     * count against the limit); no cat comes while it is 0. Returns the type id of
+     * a cat tamed this tick, or null.
+     */
+    tick(now: number, pointer: Vec, room = 1): string | null {
+      const dt = Math.max(now - lastTick, 0) / 1000;
+      lastTick = now;
+
+      // Is the pointer keeping still?
+      const moved =
+        !still || Math.hypot(pointer.x - still.at.x, pointer.y - still.at.y) > config.stillPx;
+      if (moved) still = { at: pointer, since: now };
+      const stillFor = now - still!.since;
+
+      if (!cat) {
+        if (now >= nextCatAt && room > 0 && types.length > 0) spawn(pointer);
+        return null;
+      }
+
+      // A dodge under way (or waiting for a slow cat to react) runs to its end.
+      if (motion) {
+        if (now < motion.startsAt) return null;
+        const t = Math.min((now - motion.startsAt) / (motion.endsAt - motion.startsAt), 1);
+        const eased = 1 - (1 - t) ** 3;
+        cat.x = motion.from.x + (motion.to.x - motion.from.x) * eased;
+        cat.y = motion.from.y + (motion.to.y - motion.from.y) * eased;
+        cat.doing = motion.kind;
+        if (t < 1) return null;
+        motion = null;
+        calmUntil = now + config.calmMs;
+        wanderTo = null;
+      }
+
+      const distance = Math.hypot(pointer.x - cat.x, pointer.y - cat.y);
+
+      // A pointer moving close by: dodge.
+      if (moved && distance <= config.noticeRadius && now >= calmUntil) {
+        const style = dodgeFor(cat.type);
+        const startsAt = now + style.reactMs;
+        motion = {
+          from: { x: cat.x, y: cat.y },
+          to: dodgeTarget(style, cat, pointer, viewport, random),
+          startsAt,
+          endsAt: startsAt + style.durationMs,
+          kind: style.kind,
+        };
+        holdSince = null;
+        return null;
+      }
+
+      // Held: the pointer is on the cat and keeping still.
+      if (!moved && distance <= config.catchRadius) {
+        holdSince ??= now;
+        cat.doing = 'held';
+        if (now - holdSince >= config.tameMs) {
+          const id = cat.typeId;
+          tamed = [...tamed, id];
+          cat = null;
+          holdSince = null;
+          nextCatAt = now + config.breakMs;
+          return id;
+        }
+        return null;
+      }
+      holdSince = null;
+
+      // A still pointer draws the cat over; otherwise it wanders.
+      if (stillFor >= config.curiousAfterMs) {
+        cat.doing = 'curious';
+        walk(pointer, dt);
+        wanderTo = null;
+      } else {
+        cat.doing = 'wandering';
+        wanderTo ??= randomSpot();
+        if (walk(wanderTo, dt)) wanderTo = null;
+      }
+      return null;
+    },
+  };
+}
+
+/** Tamed cats kept in localStorage: how many of each type, by id. */
+export type TamedCollection = Readonly<Record<string, number>>;
+
+export const TAMED_KEY = 'xenocats:tamed';
+
+/** Reads a stored collection; anything malformed, or not a known type, is dropped. */
+export function parseCollection(raw: string | null, types: readonly CatType[]): TamedCollection {
+  if (!raw) return {};
+  let value: unknown;
+  try {
+    value = JSON.parse(raw);
+  } catch {
+    return {};
+  }
+  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
+  const known = new Set(types.map((type) => type.id));
+  const collection: Record<string, number> = {};
+  for (const [id, count] of Object.entries(value)) {
+    if (known.has(id) && Number.isInteger(count) && (count as number) > 0) {
+      collection[id] = count as number;
+    }
+  }
+  return collection;
+}
+
+/** The collection with one more cat of `typeId`. */
+export const addTamed = (collection: TamedCollection, typeId: string): TamedCollection => ({
+  ...collection,
+  [typeId]: (collection[typeId] ?? 0) + 1,
+});
diff --git a/tests/e2e/cats.spec.ts b/tests/e2e/cats.spec.ts
index 323ce68..3feb591 100644
--- a/tests/e2e/cats.spec.ts
+++ b/tests/e2e/cats.spec.ts
@@ -33,7 +33,9 @@ async function summon(page: Page, id: string) {
   const button = page.getByTestId(`summon-${id}`);
   // Scroll first: measuring a button below the fold and then clicking it (which
   // scrolls) would record a pointer position the page has since moved away from.
-  await button.scrollIntoViewIfNeeded();
+  // Centred, so a test can move the pointer some way in any direction and stay on
+  // the page.
+  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
   const box = (await button.boundingBox())!;
   const pointer = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
   await page.mouse.move(pointer.x, pointer.y);
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
index cf7dba9..158cc03 100644
--- a/tests/e2e/fight.spec.ts
+++ b/tests/e2e/fight.spec.ts
@@ -1,5 +1,6 @@
 import { type Page, expect, test } from '@playwright/test';
 import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
+import { TAMED_KEY } from '@/app/ui/xenocats/taming';
 
 // Fight a cat on /cats (no login, no database). These tests take the fallback path:
 // pointer lock is removed before the page loads, so the game runs with the fake
@@ -92,6 +93,60 @@ test('Survival: a cat that reaches the pointer costs a life and attacks the curs
   await expect(page.getByTestId('fake-cursor')).not.toHaveAttribute('data-effect', '');
 });
 
+test('Taming: a still pointer draws the cat over, holding still on it tames it into the collection', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await openFight(page);
+  await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 0 cats');
+  await page.getByTestId('fight-start-taming').click();
+  const overlay = page.getByTestId('fight-overlay');
+  await expect(overlay).toHaveAttribute('data-kind', 'taming');
+  await expect(overlay).toHaveAttribute('data-mode', 'fallback');
+  // Keep still: the cat appears, gets curious after 1 s and walks over at 110 px/s.
+  await page.mouse.move(400, 400);
+  const cat = page.getByTestId('fight-cat');
+  await expect(cat).toBeVisible();
+  const typeId = await cat.getAttribute('data-cat-type');
+  await expect(cat).toHaveAttribute('data-doing', 'held', { timeout: 20_000 });
+  await expect(overlay.getByTestId('fight-tamed-now')).toHaveText('Tamed this game: 1', {
+    timeout: 5_000,
+  });
+
+  await page.keyboard.press('Escape');
+  await expect(page.getByRole('status').filter({ hasText: 'Taming over' })).toHaveText(
+    'Taming over. You tamed 1 cat.'
+  );
+  await expect(page.getByTestId('fight-tamed')).toHaveText('Tamed: 1 cat');
+  const stored = await page.evaluate((key) => localStorage.getItem(key), TAMED_KEY);
+  expect(JSON.parse(stored!)).toEqual({ [typeId!]: 1 });
+});
+
+test('Taming: a pointer moving at the cat makes it dodge', async ({ page }) => {
+  test.setTimeout(60_000);
+  await openFight(page);
+  await page.getByTestId('fight-start-taming').click();
+  await page.mouse.move(100, 100);
+  const cat = page.getByTestId('fight-cat');
+  await expect(cat).toBeVisible();
+  const dodges = ['dash', 'blink', 'sidestep', 'hop', 'circle', 'mirror', 'drop', 'axis'];
+  let step = 0;
+  await expect
+    .poll(
+      async () => {
+        const box = await cat.boundingBox();
+        if (box) {
+          // Wiggle towards the cat, inside its notice radius.
+          const x = box.x + box.width / 2 - 60 + (step++ % 2) * 20;
+          await page.mouse.move(x, box.y + box.height / 2);
+        }
+        return cat.getAttribute('data-doing');
+      },
+      { timeout: 15_000, intervals: [50] }
+    )
+    .toMatch(new RegExp(`^(${dodges.join('|')})$`));
+});
+
 test('Survival: a lower score leaves the best score alone; End game stops it too', async ({
   page,
 }) => {
diff --git a/tests/unit/xenocats/taming.test.ts b/tests/unit/xenocats/taming.test.ts
new file mode 100644
index 0000000..18d9dac
--- /dev/null
+++ b/tests/unit/xenocats/taming.test.ts
@@ -0,0 +1,240 @@
+import { describe, expect, it } from 'vitest';
+import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
+import { createRandom } from '@/app/ui/xenocats/random';
+import {
+  DODGES,
+  TAMING_CONFIG,
+  addTamed,
+  createTaming,
+  dodgeFor,
+  dodgeTarget,
+  parseCollection,
+} from '@/app/ui/xenocats/taming';
+
+const viewport = { width: 1200, height: 800 };
+const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
+  Math.hypot(a.x - b.x, a.y - b.y);
+
+/** A game with one cat type only, its cat already on screen. */
+function gameWith(typeId: string, pointer = { x: 100, y: 100 }, seed = 1) {
+  const g = createTaming({
+    random: createRandom(seed),
+    types: [catTypeById(typeId)!],
+    viewport,
+    now: 0,
+  });
+  g.tick(0, pointer);
+  g.tick(TAMING_CONFIG.breakMs, pointer);
+  return g;
+}
+
+describe('dodging', () => {
+  it('every cat type dodges in its own way', () => {
+    const styles = CAT_TYPES.map((type) => JSON.stringify(dodgeFor(type)));
+    expect(new Set(styles).size).toBe(CAT_TYPES.length);
+    for (const type of CAT_TYPES) expect(DODGES[type.effect.id]).toBeDefined();
+  });
+
+  it('every dodge moves the cat, and stays on screen', () => {
+    const cat = { x: 600, y: 400 };
+    const pointer = { x: 560, y: 380 };
+    for (const type of CAT_TYPES) {
+      const to = dodgeTarget(dodgeFor(type), cat, pointer, viewport, createRandom(2));
+      expect(distance(to, cat), type.id).toBeGreaterThan(10);
+      expect(to.x).toBeGreaterThanOrEqual(0);
+      expect(to.x).toBeLessThanOrEqual(viewport.width);
+      expect(to.y).toBeGreaterThanOrEqual(0);
+      expect(to.y).toBeLessThanOrEqual(viewport.height);
+    }
+  });
+
+  it('dashing, blinking, dropping and axis cats end up further from the pointer', () => {
+    const cat = { x: 600, y: 400 };
+    const pointer = { x: 540, y: 380 };
+    for (const type of CAT_TYPES) {
+      const style = dodgeFor(type);
+      if (!['dash', 'blink', 'drop', 'axis', 'mirror'].includes(style.kind)) continue;
+      const to = dodgeTarget(style, cat, pointer, viewport, createRandom(3));
+      expect(distance(to, pointer), type.id).toBeGreaterThanOrEqual(distance(cat, pointer) - 1e-9);
+    }
+  });
+
+  it('kinds behave as named', () => {
+    const cat = { x: 600, y: 400 };
+    const pointer = { x: 500, y: 400 };
+    const r = () => createRandom(4);
+    const of = (id: string) => dodgeFor(catTypeById(id)!);
+    // Laser Ocicat: along one axis only.
+    expect(dodgeTarget(of('laser-ocicat'), cat, pointer, viewport, r()).y).toBe(400);
+    // Gravity Manx: straight down.
+    expect(dodgeTarget(of('gravity-manx'), cat, pointer, viewport, r()).x).toBe(600);
+    // Mirror Sphynx: through the pointer to the other side.
+    expect(dodgeTarget(of('mirror-sphynx'), cat, pointer, viewport, r())).toEqual({
+      x: 400,
+      y: 400,
+    });
+    // Quantum Kitten: reappears at least its distance from the pointer.
+    expect(
+      distance(dodgeTarget(of('quantum-kitten'), cat, pointer, viewport, r()), pointer)
+    ).toBeGreaterThanOrEqual(400);
+  });
+
+  it('a pointer moving close makes the cat dodge away', () => {
+    const g = gameWith('pulsar-siamese'); // knockback: dashes 320 px
+    const cat = g.snapshot(TAMING_CONFIG.breakMs).cat!;
+    const near = { x: cat.x - 60, y: cat.y };
+    let now = TAMING_CONFIG.breakMs + 16;
+    g.tick(now, near);
+    for (now += 16; now < TAMING_CONFIG.breakMs + 600; now += 16) g.tick(now, near);
+    const after = g.snapshot(now).cat!;
+    expect(distance(after, near)).toBeGreaterThan(distance(cat, near) + 100);
+  });
+
+  it('the lagging cat notices late', () => {
+    const g = gameWith('lag-ragamuffin'); // delay: reacts after 800 ms
+    const cat = g.snapshot(TAMING_CONFIG.breakMs).cat!;
+    const near = { x: cat.x - 60, y: cat.y };
+    let now = TAMING_CONFIG.breakMs + 16;
+    g.tick(now, near);
+    for (now += 16; now < TAMING_CONFIG.breakMs + 700; now += 16) g.tick(now, near);
+    expect(g.snapshot(now).cat).toMatchObject({ x: cat.x, y: cat.y });
+    for (; now < TAMING_CONFIG.breakMs + 1600; now += 16) g.tick(now, near);
+    expect(distance(g.snapshot(now).cat!, cat)).toBeGreaterThan(50);
+  });
+});
+
+describe('taming: hold still on the cat for 2 s', () => {
+  /** Keeps the pointer still at `at` from `from` to `to`; returns any cat tamed. */
+  function hold(
+    g: ReturnType<typeof gameWith>,
+    at: { x: number; y: number },
+    from: number,
+    to: number
+  ) {
+    let tamed: string | null = null;
+    for (let now = from; now <= to; now += 16) tamed = g.tick(now, at) ?? tamed;
+    return tamed;
+  }
+
+  it('a still pointer draws the cat over, and two seconds on it tames the cat', () => {
+    const pointer = { x: 100, y: 100 };
+    const g = gameWith('void-tabby', pointer);
+    const start = TAMING_CONFIG.breakMs;
+    // Curious after 1 s, then it walks over (at most ~1300 px at 110 px/s), then 2 s.
+    const tamed = hold(g, pointer, start + 16, start + 20_000);
+    expect(tamed).toBe('void-tabby');
+    const snap = g.snapshot(start + 20_000);
+    expect(snap.tamed).toContain('void-tabby');
+  });
+
+  it('is tamed two seconds after the hold begins, not before', () => {
+    // Wait for the cat to come to a still pointer, and time the hold from there.
+    const pointer = { x: 100, y: 100 };
+    const g = gameWith('void-tabby', pointer);
+    const start = TAMING_CONFIG.breakMs;
+    let now = start + 16;
+    for (; now < start + 20_000; now += 16) {
+      g.tick(now, pointer);
+      if (g.snapshot(now).cat?.doing === 'held') break;
+    }
+    expect(g.snapshot(now).cat?.doing).toBe('held');
+    const heldAt = now;
+    let tamedAt: number | null = null;
+    for (now += 16; now < heldAt + 3000; now += 16) {
+      if (g.tick(now, pointer)) {
+        tamedAt = now;
+        break;
+      }
+    }
+    expect(tamedAt).not.toBeNull();
+    expect(tamedAt! - heldAt).toBeGreaterThanOrEqual(TAMING_CONFIG.tameMs);
+    expect(tamedAt! - heldAt).toBeLessThan(TAMING_CONFIG.tameMs + 50);
+  });
+
+  it('moving during the hold starts it over (and the cat dodges)', () => {
+    const pointer = { x: 100, y: 100 };
+    const g = gameWith('void-tabby', pointer);
+    let now = TAMING_CONFIG.breakMs + 16;
+    for (; now < 30_000; now += 16) {
+      g.tick(now, pointer);
+      if (g.snapshot(now).cat?.doing === 'held') break;
+    }
+    for (const end = now + 1500; now < end; now += 16) g.tick(now, pointer);
+    expect(g.snapshot(now).hold).toBeGreaterThan(0.6);
+    // A twitch of 10 px: no longer still.
+    expect(g.tick(now + 16, { x: 110, y: 100 })).toBeNull();
+    expect(g.snapshot(now + 16).hold).toBe(0);
+    expect(g.snapshot(now + 16).tamed).toEqual([]);
+  });
+
+  it('a pointer resting next to the cat, not on it, does not tame it', () => {
+    const start = TAMING_CONFIG.breakMs;
+    // A cat that never walks, so the pointer stays just off it.
+    const shy = createTaming({
+      random: createRandom(1),
+      types: [catTypeById('void-tabby')!],
+      viewport,
+      now: 0,
+      config: { curiousAfterMs: Infinity, walkSpeed: 0 },
+    });
+    shy.tick(0, { x: 0, y: 0 });
+    shy.tick(start, { x: 0, y: 0 });
+    const shyCat = shy.snapshot(start).cat!;
+    const beside = { x: shyCat.x + TAMING_CONFIG.catchRadius + 5, y: shyCat.y };
+    // The pointer lands just off the cat (which dodges), then keeps still; with no
+    // walking, the cat never comes back under it.
+    let tamed: string | null = null;
+    for (let now = start + 16; now < start + 5000; now += 16) {
+      tamed = shy.tick(now, beside) ?? tamed;
+    }
+    expect(tamed).toBeNull();
+    expect(shy.snapshot(start + 5000).hold).toBe(0);
+  });
+
+  it('after a cat is tamed, the next one comes', () => {
+    const pointer = { x: 100, y: 100 };
+    const g = gameWith('void-tabby', pointer);
+    let now = TAMING_CONFIG.breakMs + 16;
+    for (; now < 30_000; now += 16) if (g.tick(now, pointer)) break;
+    expect(g.snapshot(now).cat).toBeNull();
+    for (const end = now + TAMING_CONFIG.breakMs + 32; now < end; now += 16) g.tick(now, pointer);
+    expect(g.snapshot(now).cat).not.toBeNull();
+  });
+});
+
+describe('never more than five cats', () => {
+  it('no cat comes while the screen is full of other cats', () => {
+    const g = createTaming({ random: createRandom(1), types: CAT_TYPES, viewport, now: 0 });
+    for (let now = 0; now < 10_000; now += 16) g.tick(now, { x: 100, y: 100 }, 0);
+    expect(g.snapshot(10_000).cat).toBeNull();
+    g.tick(10_016, { x: 100, y: 100 }, 1);
+    expect(g.snapshot(10_016).cat).not.toBeNull();
+  });
+});
+
+describe('the tamed collection', () => {
+  it('counts tamed cats by type', () => {
+    expect(addTamed(addTamed({}, 'void-tabby'), 'void-tabby')).toEqual({ 'void-tabby': 2 });
+    expect(addTamed({ 'void-tabby': 1 }, 'gravi-coon')).toEqual({
+      'void-tabby': 1,
+      'gravi-coon': 1,
+    });
+  });
+
+  it('reads back what was stored, dropping anything malformed or unknown', () => {
+    expect(parseCollection(null, CAT_TYPES)).toEqual({});
+    expect(parseCollection('not json', CAT_TYPES)).toEqual({});
+    expect(parseCollection('[1,2]', CAT_TYPES)).toEqual({});
+    expect(
+      parseCollection(
+        JSON.stringify({
+          'void-tabby': 3,
+          'no-such-cat': 1,
+          'gravi-coon': -1,
+          'cryo-persian': 1.5,
+        }),
+        CAT_TYPES
+      )
+    ).toEqual({ 'void-tabby': 3 });
+  });
+});
~~~~

</details>

#### T3 — `night-2026-10-01-t3-page-hits`

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

<details><summary>Code:  10 files changed, 713 insertions(+), 2 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/dashboard/cards.tsx b/app/ui/dashboard/cards.tsx
index 6920b54..b065428 100644
--- a/app/ui/dashboard/cards.tsx
+++ b/app/ui/dashboard/cards.tsx
@@ -41,7 +41,10 @@ export function Card({
   const Icon = iconMap[type];
 
   return (
-    <div className="relative rounded-2xl border border-line bg-panel-glass p-5 pb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
+    <div
+      data-xenocat-card
+      className="relative rounded-2xl border border-line bg-panel-glass p-5 pb-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
+    >
       <span className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
         <Icon className="h-6 w-6 text-aura/40" />
       </span>
diff --git a/app/ui/global.css b/app/ui/global.css
index 723dd26..1452bc8 100644
--- a/app/ui/global.css
+++ b/app/ui/global.css
@@ -1105,3 +1105,76 @@ input[type='number']::-webkit-outer-spin-button {
     transform: translateX(200px);
   }
 }
+
+/* Cats hitting the page around the pointer (app/ui/xenocats/page-hits.ts). Every
+   rule is keyed on data-xenocat-hit, so removing the attribute ends it. */
+[data-xenocat-hit] {
+  transition:
+    transform 180ms ease-out,
+    filter 180ms ease-out;
+}
+[data-xenocat-hit='shake'] {
+  animation: xenocat-hit-shake 0.12s linear infinite;
+}
+@keyframes xenocat-hit-shake {
+  0%,
+  100% {
+    transform: translate(0, 0);
+  }
+  25% {
+    transform: translate(
+      calc(var(--xenocat-hit-amount, 3) * 1px),
+      calc(var(--xenocat-hit-amount, 3) * -1px)
+    );
+  }
+  75% {
+    transform: translate(
+      calc(var(--xenocat-hit-amount, 3) * -1px),
+      calc(var(--xenocat-hit-amount, 3) * 1px)
+    );
+  }
+}
+[data-xenocat-hit='wobble'] {
+  animation: xenocat-hit-wobble 0.9s ease-in-out infinite;
+}
+@keyframes xenocat-hit-wobble {
+  0%,
+  100% {
+    transform: rotate(calc(var(--xenocat-hit-amount, 6) * 1deg));
+  }
+  50% {
+    transform: rotate(calc(var(--xenocat-hit-amount, 6) * -1deg));
+  }
+}
+[data-xenocat-hit='tilt'] {
+  transform: rotate(calc(var(--xenocat-hit-amount, 12) * 1deg)) !important;
+}
+[data-xenocat-hit='blur'] {
+  filter: blur(calc(var(--xenocat-hit-amount, 4) * 1px)) !important;
+}
+[data-xenocat-hit='flip'] {
+  transform: scaleX(-1) !important;
+}
+[data-xenocat-hit='glow'] {
+  filter: drop-shadow(0 0 4px var(--xenocat-hit-color))
+    drop-shadow(0 0 10px var(--xenocat-hit-color)) !important;
+}
+[data-xenocat-hit='push'] {
+  transform: translate(var(--xenocat-hit-dx, 0), var(--xenocat-hit-dy, 0)) !important;
+}
+/* Scrambled or swapped text: the real text turns transparent (and stays what
+   assistive technology reads); the shown text is generated content whose alt text
+   is empty, so it is never read out. */
+[data-xenocat-hit='text'] {
+  position: relative;
+  -webkit-text-fill-color: transparent;
+}
+[data-xenocat-hit='text']::after {
+  content: attr(data-xenocat-hit-text) / '';
+  position: absolute;
+  inset: 0;
+  overflow: hidden;
+  white-space: nowrap;
+  -webkit-text-fill-color: currentcolor;
+  pointer-events: none;
+}
diff --git a/app/ui/xenocats/cat-gallery.tsx b/app/ui/xenocats/cat-gallery.tsx
index fb47240..9b5eee1 100644
--- a/app/ui/xenocats/cat-gallery.tsx
+++ b/app/ui/xenocats/cat-gallery.tsx
@@ -58,6 +58,7 @@ function Roster({ disabled }: { disabled: boolean }) {
           <li
             key={type.id}
             data-testid={`cat-card-${type.id}`}
+            data-xenocat-card
             className="flex flex-col rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-aura/60"
           >
             <div className="flex items-center gap-4">
diff --git a/app/ui/xenocats/config.ts b/app/ui/xenocats/config.ts
index 7f99af3..cf4f564 100644
--- a/app/ui/xenocats/config.ts
+++ b/app/ui/xenocats/config.ts
@@ -21,6 +21,10 @@ export type CatConfig = {
   wakeMs: number;
   /** The pounce animation once the attack has started. */
   attackMs: number;
+  /** An attack also hits page elements this close to the pointer, px. */
+  pageHitRadius: number;
+  /** At most this many page elements per attack. */
+  maxPageTargets: number;
 };
 
 export const CAT_CONFIG: CatConfig = {
@@ -33,4 +37,6 @@ export const CAT_CONFIG: CatConfig = {
   sleepMs: [8000, 22000],
   wakeMs: 900,
   attackMs: 600,
+  pageHitRadius: 120,
+  maxPageTargets: 6,
 };
diff --git a/app/ui/xenocats/fake-cursor.tsx b/app/ui/xenocats/fake-cursor.tsx
index 38a3a9e..2376d90 100644
--- a/app/ui/xenocats/fake-cursor.tsx
+++ b/app/ui/xenocats/fake-cursor.tsx
@@ -4,6 +4,7 @@ import { createContext, useContext, useEffect, useMemo, useRef, useState } from
 import { type CursorController, createCursorController } from './cursor-controller';
 import { type CursorKind, cursorKindFor } from './cursor-kind';
 import { type CursorLook, type Effect, MAX_DECOYS, type Vec } from './effects';
+import { hitPage } from './page-hits';
 import { type Random, createRandom, freshSeed } from './random';
 
 export type XenocatCursor = {
@@ -99,6 +100,8 @@ export function XenocatCursorProvider({
   const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
   const nowRef = useRef(now);
   const hiddenRef = useRef(false);
+  // Puts back the page elements the running attack hit (page-hits.ts).
+  const restoreHitsRef = useRef<(() => void) | null>(null);
 
   useEffect(() => {
     nowRef.current = now;
@@ -134,6 +137,12 @@ export function XenocatCursorProvider({
     let swallowPress = false;
     const onPointerAction = (event: Event) => {
       const blocking = controller.isBlocking(nowRef.current());
+      // The effect is over but the next frame has not put the page back yet: do it
+      // now, so no click ever reaches a displaced element.
+      if (!blocking && restoreHitsRef.current) {
+        restoreHitsRef.current();
+        restoreHitsRef.current = null;
+      }
       if (event.type === 'pointerdown') swallowPress = blocking;
       else if (event.type === 'mousedown' && blocking) swallowPress = true;
       const fromPointer = !ALSO_KEYBOARD.has(event.type) || (event as MouseEvent).detail > 0;
@@ -162,6 +171,12 @@ export function XenocatCursorProvider({
     let frameId = 0;
     const draw = () => {
       const time = nowRef.current();
+      // The page is put back on the first frame the clicks are no longer blocked, so
+      // an element is never displaced while it can be clicked.
+      if (restoreHitsRef.current && !controller.isBlocking(time)) {
+        restoreHitsRef.current();
+        restoreHitsRef.current = null;
+      }
       const drawn = controller.frame(time);
       const look = hiddenRef.current ? { ...drawn, visible: false, decoys: undefined } : drawn;
       const place = (element: HTMLElement, at: Vec) => placeCursor(element, at, look);
@@ -184,6 +199,8 @@ export function XenocatCursorProvider({
     return () => {
       cancelAnimationFrame(frameId);
       root.classList.remove(HIDE_CURSOR_CLASS);
+      restoreHitsRef.current?.();
+      restoreHitsRef.current = null;
       window.removeEventListener('pointermove', onMove);
       window.removeEventListener('pointerout', onOut);
       window.removeEventListener('blur', onBlur);
@@ -195,7 +212,16 @@ export function XenocatCursorProvider({
 
   const api = useMemo<XenocatCursor>(
     () => ({
-      attack: (effect, cat) => controller.attack(effect, cat, nowRef.current()),
+      attack: (effect, cat) => {
+        if (!controller.attack(effect, cat, nowRef.current())) return false;
+        // Every attack also hits the page around the pointer, for as long as it lasts.
+        const pointer = controller.position();
+        restoreHitsRef.current?.();
+        restoreHitsRef.current = pointer
+          ? hitPage(document.body, effect.id, pointer, cat, random)
+          : null;
+        return true;
+      },
       isBusy: () => controller.isBlocking(nowRef.current()),
       position: () => controller.position(),
       isPresent: () => controller.isPresent(),
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index fce9345..a1db72b 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -473,6 +473,7 @@ export default function Fight({
             aria-label={kind === 'survival' ? 'Fight a cat: Survival' : 'Fight a cat: Taming'}
             tabIndex={-1}
             data-testid="fight-overlay"
+            data-xenocat-ignore
             data-mode={mode}
             data-kind={kind}
             data-phase={phase}
diff --git a/app/ui/xenocats/page-hits.ts b/app/ui/xenocats/page-hits.ts
new file mode 100644
index 0000000..d4afc7b
--- /dev/null
+++ b/app/ui/xenocats/page-hits.ts
@@ -0,0 +1,289 @@
+// What a cat's attack does to the page around the pointer: every attack also hits
+// the elements near it (buttons, links, text, cards, table rows, inputs) with an
+// effect matched to the cat's attack — a shake, tilt, blur, flip or glow, a push,
+// or scrambled or swapped text. It all reverts exactly when the attack ends.
+//
+// How it stays reversible: an effect only adds `data-xenocat-hit*` attributes and
+// a few `--xenocat-hit-*` custom properties, which CSS rules in global.css turn
+// into the effect. The restore function puts the `style` attribute back exactly as
+// it was (absent stays absent) and removes the attributes. Text is never
+// rewritten: scrambled or swapped text is drawn by a `::after` whose CSS alt text
+// is empty, over the real text made transparent, so assistive technology reads
+// the real text throughout. A focused or editable field is never given text.
+
+import { CAT_CONFIG } from './config';
+import type { Vec } from './effects';
+import type { Random } from './random';
+
+export type HitKind =
+  'shake' | 'wobble' | 'tilt' | 'blur' | 'flip' | 'glow' | 'push' | 'scramble' | 'swap';
+
+export type HitStyle = {
+  kind: HitKind;
+  /** shake/wobble/blur: px or deg; tilt: deg; push: px. */
+  amount?: number;
+  /** push: away from the cat, towards it, or a fixed direction. */
+  direction?: 'away' | 'toward' | 'down' | 'up' | 'sideways';
+  /** glow: a CSS colour. */
+  color?: string;
+};
+
+/** Each attack's effect on the page, keyed by effect id. */
+export const PAGE_HITS: Readonly<Record<string, HitStyle>> = {
+  vanish: { kind: 'blur', amount: 6 },
+  heavy: { kind: 'push', amount: 18, direction: 'down' },
+  knockback: { kind: 'push', amount: 40, direction: 'away' },
+  reverse: { kind: 'flip' },
+  jitter: { kind: 'shake', amount: 3 },
+  freeze: { kind: 'glow', color: '#7dd3fc' },
+  drift: { kind: 'push', amount: 24, direction: 'away' },
+  teleport: { kind: 'swap' },
+  magnet: { kind: 'push', amount: 30, direction: 'toward' },
+  orbit: { kind: 'tilt', amount: 12 },
+  decoys: { kind: 'scramble' },
+  drunk: { kind: 'wobble', amount: 6 },
+  tiny: { kind: 'shake', amount: 1.5 },
+  giant: { kind: 'shake', amount: 6 },
+  delay: { kind: 'blur', amount: 2 },
+  fall: { kind: 'push', amount: 40, direction: 'down' },
+  blur: { kind: 'blur', amount: 4 },
+  spiral: { kind: 'tilt', amount: 25 },
+  bounce: { kind: 'push', amount: 20, direction: 'up' },
+  'axis-lock': { kind: 'push', amount: 30, direction: 'sideways' },
+};
+
+/** What a page element can be hit as: the ones that look like controls, text or cards. */
+export const HIT_SELECTOR = [
+  'a[href]',
+  'button',
+  'input',
+  'select',
+  'textarea',
+  'label',
+  'h1',
+  'h2',
+  'h3',
+  'h4',
+  'p',
+  'li',
+  // Rows, not their cells: a cell is always as near as its row and smaller, so
+  // with cells listed no row would ever be hit.
+  'tr',
+  '[data-xenocat-card]',
+].join(',');
+
+/** Never hit: the cats, the cursor, the game overlay and anything hidden from AT. */
+export const IGNORE_SELECTOR = '[aria-hidden="true"], [data-xenocat-ignore]';
+
+export type Rect = { left: number; top: number; right: number; bottom: number };
+
+/** How far `point` is from the nearest edge of `rect`; 0 inside it. */
+export function distanceToRect(point: Vec, rect: Rect): number {
+  const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
+  const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
+  return Math.hypot(dx, dy);
+}
+
+export type Candidate<T> = { item: T; rect: Rect };
+
+/**
+ * The elements an attack hits: within `radius` of the pointer, nearest first (the
+ * smaller of two equally near), at most `max`, and never one inside another that
+ * is already hit (their effects would add up). `contains(a, b)` says whether `a`
+ * contains `b`.
+ */
+export function selectTargets<T>(
+  candidates: readonly Candidate<T>[],
+  pointer: Vec,
+  radius: number,
+  max: number,
+  contains: (a: T, b: T) => boolean
+): T[] {
+  const area = (r: Rect) => (r.right - r.left) * (r.bottom - r.top);
+  const near = candidates
+    .map((c) => ({ ...c, distance: distanceToRect(pointer, c.rect) }))
+    // Anything under 2 × 2 px is hidden (e.g. a screen-reader-only label).
+    .filter(
+      (c) =>
+        c.distance <= radius && c.rect.right - c.rect.left >= 2 && c.rect.bottom - c.rect.top >= 2
+    )
+    .sort((a, b) => a.distance - b.distance || area(a.rect) - area(b.rect));
+  const picked: T[] = [];
+  for (const c of near) {
+    if (picked.length >= max) break;
+    if (picked.some((p) => contains(p, c.item) || contains(c.item, p))) continue;
+    picked.push(c.item);
+  }
+  return picked;
+}
+
+/**
+ * The same text with the letters of each word shuffled, spaces and punctuation in
+ * place. A word that shuffles back to itself gets its first two letters swapped.
+ */
+export function scrambleText(text: string, random: Random): string {
+  return text.replace(/[\p{L}\p{N}]{2,}/gu, (word) => {
+    const letters = [...word];
+    for (let i = letters.length - 1; i > 0; i--) {
+      const j = random.int(0, i);
+      [letters[i], letters[j]] = [letters[j], letters[i]];
+    }
+    const out = letters.join('');
+    if (out !== word || new Set(word).size === 1) return out;
+    return letters[1] + letters[0] + letters.slice(2).join('');
+  });
+}
+
+/** True for an element whose only content is text: its text can be drawn over. */
+function isTextLeaf(element: Element): boolean {
+  if (element.children.length > 0) return false;
+  if (element.matches('input, select, textarea, [contenteditable], [contenteditable] *')) {
+    return false;
+  }
+  return (element.textContent ?? '').trim().length > 0;
+}
+
+/** A focused or editable field, or anything around one, never has its text touched. */
+function mayTouchText(element: Element): boolean {
+  const active = element.ownerDocument.activeElement;
+  if (active && active !== element.ownerDocument.body && element.contains(active)) return false;
+  return isTextLeaf(element);
+}
+
+const PROPERTIES = [
+  '--xenocat-hit-amount',
+  '--xenocat-hit-dx',
+  '--xenocat-hit-dy',
+  '--xenocat-hit-color',
+] as const;
+
+export const HIT_ATTRIBUTE = 'data-xenocat-hit';
+export const TEXT_ATTRIBUTE = 'data-xenocat-hit-text';
+
+/**
+ * Applies `style` to `targets` for an attack by a cat centred at `cat`. Returns
+ * the function that puts every target back exactly as it was.
+ */
+export function applyHits(
+  targets: readonly HTMLElement[],
+  style: HitStyle,
+  cat: Vec,
+  random: Random
+): () => void {
+  const saved = targets.map((element) => ({
+    element,
+    styleAttribute: element.getAttribute('style'),
+    hit: element.getAttribute(HIT_ATTRIBUTE),
+    text: element.getAttribute(TEXT_ATTRIBUTE),
+  }));
+
+  const set = (element: HTMLElement, name: (typeof PROPERTIES)[number], value: string) =>
+    element.style.setProperty(name, value);
+  // No inline style for text: the CSS hides the real text with a transparent text
+  // fill and paints the shown text in the element's own colour.
+  const textOver = (element: HTMLElement, text: string) => {
+    element.setAttribute(TEXT_ATTRIBUTE, text);
+    element.setAttribute(HIT_ATTRIBUTE, 'text');
+  };
+
+  if (style.kind === 'scramble') {
+    for (const element of targets) {
+      if (mayTouchText(element)) textOver(element, scrambleText(element.textContent!, random));
+      else element.setAttribute(HIT_ATTRIBUTE, 'shake');
+    }
+  } else if (style.kind === 'swap') {
+    // Pairs of text elements trade their text; anything left over shakes.
+    const texts = targets.filter(mayTouchText);
+    for (let i = 0; i + 1 < texts.length; i += 2) {
+      const [a, b] = [texts[i], texts[i + 1]];
+      const [textA, textB] = [a.textContent!, b.textContent!];
+      textOver(a, textB);
+      textOver(b, textA);
+    }
+    for (const element of targets) {
+      if (!element.hasAttribute(TEXT_ATTRIBUTE)) element.setAttribute(HIT_ATTRIBUTE, 'shake');
+    }
+  } else {
+    for (const element of targets) {
+      if (style.amount !== undefined) set(element, '--xenocat-hit-amount', String(style.amount));
+      if (style.color) set(element, '--xenocat-hit-color', style.color);
+      if (style.kind === 'push') {
+        const { x, y } = pushVector(element, style, cat);
+        set(element, '--xenocat-hit-dx', `${x}px`);
+        set(element, '--xenocat-hit-dy', `${y}px`);
+      }
+      element.setAttribute(HIT_ATTRIBUTE, style.kind);
+    }
+  }
+
+  return () => {
+    for (const { element, styleAttribute, hit, text } of saved) {
+      // The very text it had, not a re-serialisation of it.
+      if (styleAttribute === null) element.removeAttribute('style');
+      else element.setAttribute('style', styleAttribute);
+      if (hit === null) element.removeAttribute(HIT_ATTRIBUTE);
+      else element.setAttribute(HIT_ATTRIBUTE, hit);
+      if (text === null) element.removeAttribute(TEXT_ATTRIBUTE);
+      else element.setAttribute(TEXT_ATTRIBUTE, text);
+    }
+  };
+}
+
+function pushVector(element: HTMLElement, style: HitStyle, cat: Vec): Vec {
+  const amount = style.amount ?? 20;
+  const rect = element.getBoundingClientRect();
+  const centre = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
+  const dx = centre.x - cat.x;
+  const dy = centre.y - cat.y;
+  const length = Math.hypot(dx, dy) || 1;
+  switch (style.direction) {
+    case 'toward':
+      return { x: (-dx / length) * amount, y: (-dy / length) * amount };
+    case 'down':
+      return { x: 0, y: amount };
+    case 'up':
+      return { x: 0, y: -amount };
+    case 'sideways':
+      return { x: Math.sign(dx || 1) * amount, y: 0 };
+    default:
+      return { x: (dx / length) * amount, y: (dy / length) * amount };
+  }
+}
+
+function containsFocusedField(element: Element): boolean {
+  const active = element.ownerDocument.activeElement;
+  return (
+    active !== null &&
+    element.contains(active) &&
+    active.matches('input, select, textarea, [contenteditable]:not([contenteditable="false"])')
+  );
+}
+
+/**
+ * Hits the page around `pointer` for an attack whose effect is `effectId`, by a
+ * cat centred at `cat`. Returns the restore function, or null if nothing was hit.
+ */
+export function hitPage(
+  root: ParentNode,
+  effectId: string,
+  pointer: Vec,
+  cat: Vec,
+  random: Random,
+  options: { radius?: number; max?: number } = {}
+): (() => void) | null {
+  const style = PAGE_HITS[effectId];
+  if (!style) return null;
+  const candidates = Array.from(root.querySelectorAll<HTMLElement>(HIT_SELECTOR))
+    .filter((element) => !element.closest(IGNORE_SELECTOR))
+    // The field being typed in is left alone altogether, not just its text.
+    .filter((element) => !containsFocusedField(element))
+    .map((element) => ({ item: element, rect: element.getBoundingClientRect() }));
+  const targets = selectTargets(
+    candidates,
+    pointer,
+    options.radius ?? CAT_CONFIG.pageHitRadius,
+    options.max ?? CAT_CONFIG.maxPageTargets,
+    (a, b) => a !== b && a.contains(b)
+  );
+  return targets.length > 0 ? applyHits(targets, style, cat, random) : null;
+}
diff --git a/tests/e2e/cats.spec.ts b/tests/e2e/cats.spec.ts
index 3feb591..f2f882a 100644
--- a/tests/e2e/cats.spec.ts
+++ b/tests/e2e/cats.spec.ts
@@ -467,3 +467,45 @@ test('all 20 cats are on /cats, and a sixth summon is refused while five are on
   await expect(page.getByTestId('xenocat')).toHaveCount(5);
   await expect(page.locator('[data-cat-type="hypno-rex"]')).toHaveCount(0);
 });
+
+test('an attack pushes the page elements near the pointer, and puts them back exactly', async ({
+  page,
+}) => {
+  await openCats(page);
+  const button = page.getByTestId('summon-pulsar-siamese');
+  await summon(page, 'pulsar-siamese');
+  const before = await button.evaluate((el) => el.outerHTML);
+  // Pulsar Siamese's knockback pushes the button under the pointer away from it.
+  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'knockback');
+  await expect(button).toHaveAttribute('data-xenocat-hit', 'push');
+  await expect.poll(() => button.evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
+  // When the effect ends (1.5 s) the button is exactly as it was.
+  await expect(fakeCursor(page)).toHaveAttribute('data-effect', '', { timeout: 5000 });
+  await expect.poll(() => button.evaluate((el) => el.outerHTML)).toBe(before);
+});
+
+test('an attack scrambles the text near the pointer for the eye only, then restores it', async ({
+  page,
+}) => {
+  await openCats(page);
+  const card = page.getByTestId('cat-card-decoy-burmese');
+  const texts = await card.evaluate((el) =>
+    Array.from(el.querySelectorAll('*'), (child) => child.textContent)
+  );
+  const before = await card.evaluate((el) => el.outerHTML);
+  await summon(page, 'decoy-burmese');
+  await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'decoys');
+  const scrambled = card.locator('[data-xenocat-hit="text"]').first();
+  await expect(scrambled).toBeAttached();
+  const shown = await scrambled.getAttribute('data-xenocat-hit-text');
+  expect(shown).not.toBe(await scrambled.textContent());
+  // The real text, which assistive technology reads, never changes.
+  await expect(card.getByRole('heading', { name: 'Decoy Burmese' })).toBeVisible();
+  expect(
+    await card.evaluate((el) => Array.from(el.querySelectorAll('*'), (child) => child.textContent))
+  ).toEqual(texts);
+  // After the effect (5 s) nothing is left of it.
+  await expect(card.locator('[data-xenocat-hit]')).toHaveCount(0, { timeout: 8000 });
+  // The card is exactly as it was before the cat came.
+  expect(await card.evaluate((el) => el.outerHTML)).toBe(before);
+});
diff --git a/tests/unit/xenocats/fake-cursor.test.tsx b/tests/unit/xenocats/fake-cursor.test.tsx
index 9b2683c..fa0f752 100644
--- a/tests/unit/xenocats/fake-cursor.test.tsx
+++ b/tests/unit/xenocats/fake-cursor.test.tsx
@@ -275,4 +275,40 @@ describe('XenocatCursorProvider', () => {
     fireEvent.pointerOut(document.body, { relatedTarget: null });
     await waitFor(() => expect(fake.style.opacity).toBe('0'));
   });
+  it('every attack also hits the page near the pointer, and puts it back exactly when it ends', async () => {
+    mockPointer(true);
+    renderPage();
+    const save = screen.getByText('Save');
+    save.getBoundingClientRect = () =>
+      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
+    const before = save.outerHTML;
+    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
+    await waitFor(() => expect(cursor.position()).not.toBeNull());
+    act(() => {
+      cursor.attack(vanish, { x: 300, y: 300 });
+    });
+    expect(save.getAttribute('data-xenocat-hit')).toBe('blur');
+    clock = vanish.durationMs - 1;
+    await new Promise((resolve) => requestAnimationFrame(resolve));
+    expect(save.getAttribute('data-xenocat-hit')).toBe('blur');
+    clock = vanish.durationMs;
+    await waitFor(() => expect(save.outerHTML).toBe(before));
+  });
+
+  it('puts the page back if it goes away mid-attack', async () => {
+    mockPointer(true);
+    renderPage();
+    const save = screen.getByText('Save');
+    save.getBoundingClientRect = () =>
+      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
+    fireEvent.pointerMove(window, { clientX: 10, clientY: 10 });
+    await waitFor(() => expect(cursor.position()).not.toBeNull());
+    act(() => {
+      cursor.attack(vanish, { x: 300, y: 300 });
+    });
+    expect(save.hasAttribute('data-xenocat-hit')).toBe(true);
+    // Unmounting the provider removes the button too; keep a handle and check it.
+    cleanup();
+    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
+  });
 });
diff --git a/tests/unit/xenocats/page-hits.test.ts b/tests/unit/xenocats/page-hits.test.ts
new file mode 100644
index 0000000..aa4c113
--- /dev/null
+++ b/tests/unit/xenocats/page-hits.test.ts
@@ -0,0 +1,234 @@
+// @vitest-environment jsdom
+import { afterEach, describe, expect, it } from 'vitest';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import {
+  HIT_ATTRIBUTE,
+  PAGE_HITS,
+  TEXT_ATTRIBUTE,
+  applyHits,
+  distanceToRect,
+  hitPage,
+  scrambleText,
+  selectTargets,
+} from '@/app/ui/xenocats/page-hits';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+afterEach(() => {
+  document.body.innerHTML = '';
+});
+
+const rect = (left: number, top: number, width: number, height: number) => ({
+  left,
+  top,
+  right: left + width,
+  bottom: top + height,
+});
+
+/** Gives an element a fixed layout box (jsdom has none). */
+function place(element: Element, left: number, top: number, width: number, height: number) {
+  element.getBoundingClientRect = () =>
+    ({ ...rect(left, top, width, height), x: left, y: top, width, height }) as DOMRect;
+}
+
+describe('every attack hits the page', () => {
+  it('each cat type has a page effect', () => {
+    for (const type of CAT_TYPES) expect(PAGE_HITS[type.effect.id], type.id).toBeDefined();
+  });
+});
+
+describe('target selection', () => {
+  const none = () => false;
+
+  it('measures the distance to the nearest edge, 0 inside', () => {
+    expect(distanceToRect({ x: 5, y: 5 }, rect(0, 0, 10, 10))).toBe(0);
+    expect(distanceToRect({ x: 13, y: 14 }, rect(0, 0, 10, 10))).toBe(5);
+  });
+
+  it('takes only elements within the radius, nearest first, up to the maximum', () => {
+    const candidates = [
+      { item: 'far', rect: rect(500, 500, 10, 10) },
+      { item: 'b', rect: rect(150, 100, 10, 10) },
+      { item: 'a', rect: rect(110, 100, 10, 10) },
+      { item: 'c', rect: rect(190, 100, 10, 10) },
+    ];
+    const pointer = { x: 100, y: 105 };
+    expect(selectTargets(candidates, pointer, 120, 10, none)).toEqual(['a', 'b', 'c']);
+    expect(selectTargets(candidates, pointer, 120, 2, none)).toEqual(['a', 'b']);
+    expect(selectTargets(candidates, pointer, 30, 10, none)).toEqual(['a']);
+  });
+
+  it('never takes an element inside one already taken, or around it', () => {
+    const tree: Record<string, string[]> = { card: ['button'], row: [] };
+    const contains = (a: string, b: string) => tree[a]?.includes(b) ?? false;
+    const candidates = [
+      { item: 'card', rect: rect(0, 0, 300, 200) },
+      { item: 'button', rect: rect(20, 20, 80, 30) },
+      { item: 'row', rect: rect(0, 210, 300, 20) },
+    ];
+    // The pointer is on the button, inside the card: the button (smaller) wins.
+    expect(selectTargets(candidates, { x: 30, y: 30 }, 50, 10, contains)).toEqual(['button']);
+  });
+
+  it('ignores elements with no size (hidden)', () => {
+    expect(
+      selectTargets([{ item: 'x', rect: rect(0, 0, 0, 0) }], { x: 0, y: 0 }, 100, 5, none)
+    ).toEqual([]);
+  });
+
+  it('hitPage skips the cats, the cursor and anything hidden from assistive technology', () => {
+    document.body.innerHTML = `
+      <button id="ok">Pay</button>
+      <div aria-hidden="true"><button id="cat">cat</button></div>
+      <div data-xenocat-ignore><p id="game">game</p></div>`;
+    for (const id of ['ok', 'cat', 'game']) place(document.getElementById(id)!, 10, 10, 50, 20);
+    const restore = hitPage(
+      document.body,
+      'jitter',
+      { x: 20, y: 20 },
+      { x: 0, y: 0 },
+      createRandom(1)
+    );
+    expect(document.getElementById('ok')!.getAttribute(HIT_ATTRIBUTE)).toBe('shake');
+    expect(document.getElementById('cat')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
+    expect(document.getElementById('game')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
+    restore!();
+  });
+
+  it('hitPage leaves a field being typed in alone, and skips hidden 1 px labels', () => {
+    document.body.innerHTML = `
+      <label id="sr" class="sr-only" for="q">Search</label>
+      <div data-xenocat-card id="box"><input id="q" /></div>
+      <button id="ok">Pay</button>`;
+    place(document.getElementById('sr')!, 10, 10, 1, 1);
+    place(document.getElementById('box')!, 0, 0, 200, 40);
+    place(document.getElementById('q')!, 10, 10, 150, 20);
+    place(document.getElementById('ok')!, 10, 50, 50, 20);
+    (document.getElementById('q') as HTMLInputElement).focus();
+    const restore = hitPage(
+      document.body,
+      'reverse',
+      { x: 20, y: 20 },
+      { x: 0, y: 0 },
+      createRandom(1)
+    );
+    for (const id of ['sr', 'q', 'box']) {
+      expect(document.getElementById(id)!.hasAttribute(HIT_ATTRIBUTE), id).toBe(false);
+    }
+    expect(document.getElementById('ok')!.getAttribute(HIT_ATTRIBUTE)).toBe('flip');
+    restore!();
+  });
+
+  it('hits a table row as a whole', () => {
+    document.body.innerHTML =
+      '<table><tbody><tr id="row"><td id="a">Paid</td><td id="b">$10</td></tr></tbody></table>';
+    place(document.getElementById('row')!, 0, 0, 300, 30);
+    place(document.getElementById('a')!, 0, 0, 150, 30);
+    place(document.getElementById('b')!, 150, 0, 150, 30);
+    const restore = hitPage(
+      document.body,
+      'jitter',
+      { x: 20, y: 10 },
+      { x: 0, y: 0 },
+      createRandom(1)
+    );
+    expect(document.getElementById('row')!.getAttribute(HIT_ATTRIBUTE)).toBe('shake');
+    expect(document.getElementById('a')!.hasAttribute(HIT_ATTRIBUTE)).toBe(false);
+    restore!();
+  });
+
+  it('hitPage hits nothing, and returns null, with nothing near', () => {
+    document.body.innerHTML = '<button id="far">Far</button>';
+    place(document.getElementById('far')!, 900, 900, 50, 20);
+    expect(
+      hitPage(document.body, 'jitter', { x: 0, y: 0 }, { x: 0, y: 0 }, createRandom(1))
+    ).toBeNull();
+  });
+});
+
+describe('scrambled text', () => {
+  it('shuffles letters within words and keeps spaces and punctuation', () => {
+    const text = 'Create invoice, now!';
+    const out = scrambleText(text, createRandom(3));
+    expect(out).not.toBe(text);
+    expect(out).toHaveLength(text.length);
+    expect(out.replace(/[\p{L}]/gu, '_')).toBe(text.replace(/[\p{L}]/gu, '_'));
+    const sorted = (s: string) => [...s.replace(/[^\p{L}]/gu, '')].sort().join('');
+    expect(sorted(out)).toBe(sorted(text));
+  });
+});
+
+describe('every effect reverts exactly', () => {
+  const page = `
+    <div data-xenocat-card class="card" id="card">
+      <h2 id="title">Total paid</h2>
+      <p id="sum" style="color: red">$1,200.00</p>
+      <a href="/x" id="link" class="link">Details</a>
+      <button id="btn" style="transform: translateX(2px); margin: 0px">Pay now</button>
+    </div>
+    <input id="field" value="typing" />`;
+
+  for (const [effectId, style] of Object.entries(PAGE_HITS)) {
+    it(`${effectId} (${style.kind})`, () => {
+      document.body.innerHTML = page;
+      const field = document.getElementById('field') as HTMLInputElement;
+      field.focus();
+      const before = document.body.innerHTML;
+      const texts = Array.from(document.querySelectorAll('*'), (el) => el.textContent);
+      const targets = ['title', 'sum', 'link', 'btn', 'field'].map((id) =>
+        document.getElementById(id)!
+      );
+      targets.forEach((el, i) => place(el, 10 + i * 60, 10, 50, 20));
+
+      const restore = applyHits(targets, style, { x: 0, y: 0 }, createRandom(7));
+      // Something happened to every target...
+      for (const el of targets) expect(el.hasAttribute(HIT_ATTRIBUTE), el.id).toBe(true);
+      // ...but the real text (what assistive technology reads) never changed,
+      // focus stayed put, and the focused field got no text.
+      expect(Array.from(document.querySelectorAll('*'), (el) => el.textContent)).toEqual(texts);
+      expect(document.activeElement).toBe(field);
+      expect(field.hasAttribute(TEXT_ATTRIBUTE)).toBe(false);
+      expect(field.value).toBe('typing');
+
+      restore();
+      expect(document.body.innerHTML).toBe(before);
+      expect(document.activeElement).toBe(field);
+    });
+  }
+
+  it('scrambling draws other text over the real text', () => {
+    document.body.innerHTML = '<p id="p">Latest invoices</p>';
+    const p = document.getElementById('p')!;
+    const restore = applyHits([p], PAGE_HITS.decoys, { x: 0, y: 0 }, createRandom(2));
+    expect(p.getAttribute(HIT_ATTRIBUTE)).toBe('text');
+    const shown = p.getAttribute(TEXT_ATTRIBUTE)!;
+    expect(shown).not.toBe('Latest invoices');
+    expect(shown).toHaveLength('Latest invoices'.length);
+    expect(p.textContent).toBe('Latest invoices');
+    restore();
+    expect(p.outerHTML).toBe('<p id="p">Latest invoices</p>');
+  });
+
+  it('swapping trades the text of two elements', () => {
+    document.body.innerHTML = '<p id="a">Paid</p><p id="b">Pending</p>';
+    const [a, b] = [document.getElementById('a')!, document.getElementById('b')!];
+    const restore = applyHits([a, b], PAGE_HITS.teleport, { x: 0, y: 0 }, createRandom(2));
+    expect(a.getAttribute(TEXT_ATTRIBUTE)).toBe('Pending');
+    expect(b.getAttribute(TEXT_ATTRIBUTE)).toBe('Paid');
+    restore();
+    expect(document.body.innerHTML).toBe('<p id="a">Paid</p><p id="b">Pending</p>');
+  });
+
+  it('a push moves away from the cat, or towards it for the magnet', () => {
+    document.body.innerHTML = '<button id="b">Go</button>';
+    const button = document.getElementById('b')!;
+    place(button, 100, 100, 20, 20);
+    const cat = { x: 0, y: 110 };
+    let restore = applyHits([button], PAGE_HITS.knockback, cat, createRandom(1));
+    expect(parseFloat(button.style.getPropertyValue('--xenocat-hit-dx'))).toBeGreaterThan(0);
+    restore();
+    restore = applyHits([button], PAGE_HITS.magnet, cat, createRandom(1));
+    expect(parseFloat(button.style.getPropertyValue('--xenocat-hit-dx'))).toBeLessThan(0);
+    restore();
+    expect(button.outerHTML).toBe('<button id="b">Go</button>');
+  });
+});
~~~~

</details>

#### T4 — `night-2026-10-01-t4-sounds`

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

<details><summary>Code:  5 files changed, 630 insertions(+), 6 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index dce1d79..f75af69 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -9,13 +9,23 @@ import {
   useMemo,
   useRef,
   useState,
+  useSyncExternalStore,
 } from 'react';
-import { type Cat, type CatEngine, createCatEngine } from './cat-engine';
+import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/solid';
+import { type Cat, type CatEngine, type CatPhase, createCatEngine } from './cat-engine';
 import { catArt } from './cat-art';
 import { CatSprite } from './cat-sprite';
 import { CAT_TYPES, type CatType } from './cat-types';
 import type { CatConfig } from './config';
 import { useXenocatCursor } from './fake-cursor';
+import {
+  type CatSounds,
+  createSoundPlayer,
+  getSoundEnabled,
+  setSoundEnabled,
+  soundsFor,
+  subscribeSound,
+} from './sounds';
 
 export type Xenocats = {
   /**
@@ -25,6 +35,8 @@ export type Xenocats = {
   summon(typeId: string, options?: { asleep?: boolean }): boolean;
   /** How many of these cats are on screen now. */
   count(): number;
+  /** Plays one of a cat type's sounds (if sound is on and allowed yet). */
+  sound(typeId: string, which: keyof CatSounds): void;
 };
 
 const CatsContext = createContext<Xenocats | null>(null);
@@ -64,6 +76,13 @@ export function XenocatCatsProvider({
     })
   );
   const [cats, setCats] = useState<Cat[]>([]);
+  const [player] = useState(() => createSoundPlayer());
+  // Read by the loop and the API, which should not restart when a caller passes a
+  // new (equal) list.
+  const typesRef = useRef(types);
+  useEffect(() => {
+    typesRef.current = types;
+  }, [types]);
   // What a stomp shakes: the page content only. The cat layer (below) and the fake
   // cursor sit outside it, so a transform here can never move them.
   const pageRef = useRef<HTMLDivElement>(null);
@@ -74,7 +93,37 @@ export function XenocatCatsProvider({
     window.addEventListener('resize', onResize);
 
     let frameId = 0;
+    // Browsers let audio start only after a user gesture: one of these (on a touch
+    // screen only pointerup, touchend and click count).
+    const unlock = () => player.unlock();
+    const gestures = [
+      'keydown',
+      'mousedown',
+      'pointerdown',
+      'pointerup',
+      'touchend',
+      'click',
+    ] as const;
+    for (const type of gestures) window.addEventListener(type, unlock, { capture: true });
+
+    // A cat's sounds follow its phases: arriving, then waking up.
+    const phases = new Map<number, CatPhase>();
+    const playPhases = () => {
+      const seen = new Set<number>();
+      for (const cat of engine.cats()) {
+        seen.add(cat.id);
+        if (phases.get(cat.id) === cat.phase) continue;
+        phases.set(cat.id, cat.phase);
+        const type = typesRef.current.find((t) => t.id === cat.typeId);
+        if (!type) continue;
+        if (cat.phase === 'appearing') player.play(soundsFor(type).arrive);
+        if (cat.phase === 'waking') player.play(soundsFor(type).wake);
+      }
+      for (const id of phases.keys()) if (!seen.has(id)) phases.delete(id);
+    };
+
     const tick = () => {
+      playPhases();
       const changed = engine.tick(cursor.now(), cursor.position(), (_cat, type, centre) => {
         // No cursor at all (a touch screen, or the pointer not seen yet): the cat
         // pounces at nothing and leaves, rather than waiting on screen for ever.
@@ -84,7 +133,9 @@ export function XenocatCatsProvider({
         if (!cursor.isPresent()) return false;
         // The page is drawing its own pointer (a locked Fight game): wait until it is done.
         if (cursor.isHidden()) return false;
-        return cursor.attack(type.effect, centre);
+        if (!cursor.attack(type.effect, centre)) return false;
+        player.play(soundsFor(type).attack);
+        return true;
       });
       if (changed) setCats(snapshot(engine));
       frameId = requestAnimationFrame(tick);
@@ -94,8 +145,9 @@ export function XenocatCatsProvider({
     return () => {
       cancelAnimationFrame(frameId);
       window.removeEventListener('resize', onResize);
+      for (const type of gestures) window.removeEventListener(type, unlock, { capture: true });
     };
-  }, [engine, cursor]);
+  }, [engine, cursor, player]);
 
   const api = useMemo<Xenocats>(
     () => ({
@@ -105,8 +157,12 @@ export function XenocatCatsProvider({
         return cat !== null;
       },
       count: () => engine.cats().length,
+      sound: (typeId, which) => {
+        const type = typesRef.current.find((t) => t.id === typeId);
+        if (type) player.play(soundsFor(type)[which]);
+      },
     }),
-    [engine, cursor]
+    [engine, cursor, player]
   );
 
   return (
@@ -132,6 +188,7 @@ export function XenocatCatsProvider({
           ) : null;
         })}
       </div>
+      <SoundToggle />
     </CatsContext.Provider>
   );
 }
@@ -232,3 +289,23 @@ function CatView({
     </div>
   );
 }
+
+/** The speaker in the corner: cat sounds on (the default) or off, remembered. */
+function SoundToggle() {
+  const on = useSyncExternalStore(subscribeSound, getSoundEnabled, () => true);
+  const Icon = on ? SpeakerWaveIcon : SpeakerXMarkIcon;
+  return (
+    <button
+      type="button"
+      data-testid="sound-toggle"
+      data-xenocat-ignore
+      aria-label="Cat sounds"
+      aria-pressed={on}
+      title={on ? 'Cat sounds on' : 'Cat sounds off'}
+      onClick={() => setSoundEnabled(!on)}
+      className="fixed bottom-4 right-4 z-[9997] flex h-10 w-10 items-center justify-center rounded-full border border-line bg-panel text-aura shadow-glow transition hover:text-plasma focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
+    >
+      <Icon className="h-5 w-5" aria-hidden="true" />
+    </button>
+  );
+}
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index a1db72b..c738bef 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -277,6 +277,16 @@ export default function Fight({
     const game = gameRef.current;
     if (!game) return;
 
+    // Each game cat makes its arrival sound once, when it first shows up.
+    const heard = new Set<number>();
+    const hearArrivals = (list: readonly { id: number; typeId: string }[]) => {
+      for (const cat of list) {
+        if (heard.has(cat.id)) continue;
+        heard.add(cat.id);
+        cats.sound(cat.typeId, 'arrive');
+      }
+    };
+
     const moveCats = (list: readonly { id: number; x: number; y: number }[]) => {
       const elements = dialogRef.current?.querySelectorAll<HTMLElement>('[data-cat-id]') ?? [];
       for (const element of elements) {
@@ -312,6 +322,7 @@ export default function Fight({
             setMessage(`You tamed ${catTypeById(tamed)?.name ?? 'a cat'}!`);
           }
           const snapshot = game.taming.snapshot(now);
+          hearArrivals(snapshot.cat ? [snapshot.cat] : []);
           moveCats(snapshot.cat ? [snapshot.cat] : []);
           const { cat, hold } = snapshot;
           const key = `${cat?.id}|${cat?.doing}|${Math.round(hold * 50)}|${snapshot.tamed.length}`;
@@ -325,10 +336,14 @@ export default function Fight({
             const type = catTypeById(cat.typeId);
             if (!type) continue;
             // One effect at a time: a cat landing during another's still costs a life.
-            if (game.mode === 'locked' && game.pointer) game.pointer.attack(type.effect, cat, now);
-            else cursor.attack(type.effect, cat);
+            const hit =
+              game.mode === 'locked' && game.pointer
+                ? game.pointer.attack(type.effect, cat, now)
+                : cursor.attack(type.effect, cat);
+            if (hit) cats.sound(type.id, 'attack');
           }
           const snapshot = game.survival.snapshot();
+          hearArrivals(snapshot.cats);
           moveCats(snapshot.cats);
           const { status, lives, wave, score } = snapshot;
           const ids = snapshot.cats.map((cat) => cat.id).join(',');
diff --git a/app/ui/xenocats/sounds.ts b/app/ui/xenocats/sounds.ts
new file mode 100644
index 0000000..df5335a
--- /dev/null
+++ b/app/ui/xenocats/sounds.ts
@@ -0,0 +1,259 @@
+// The cats' sounds, synthesised with Web Audio: no audio files. Every attack has its
+// own sound; every cat also has a sound for arriving and one for waking up, pitched
+// to the cat. Sound is on by default and can be switched off (and stays off, in
+// localStorage). Nothing plays before the visitor's first gesture on the page, as
+// browsers require, and where Web Audio is missing nothing plays and nothing breaks.
+
+import type { CatType } from './cat-types';
+
+export type Tone = {
+  /** An oscillator shape, or white noise. */
+  wave: OscillatorType | 'noise';
+  /** Hz; ignored for noise. */
+  freq: number;
+  /** Glides to this frequency by the end of the tone. */
+  endFreq?: number;
+  /** Seconds after the sound starts. */
+  at: number;
+  /** Seconds. */
+  duration: number;
+  /** Peak volume, 0–1. */
+  gain: number;
+};
+
+export type Sound = readonly Tone[];
+
+const tone = (
+  wave: Tone['wave'],
+  freq: number,
+  at: number,
+  duration: number,
+  gain = 0.5,
+  endFreq?: number
+): Tone => ({ wave, freq, at, duration, gain, ...(endFreq ? { endFreq } : {}) });
+
+/** Each attack's sound, keyed by effect id. */
+export const ATTACK_SOUNDS: Readonly<Record<string, Sound>> = {
+  // A long falling whoosh: the cursor is gone.
+  vanish: [tone('sine', 880, 0, 0.5, 0.5, 110)],
+  // A low, heavy drop.
+  heavy: [tone('square', 110, 0, 0.6, 0.35, 55)],
+  // A thump, then a rising zing.
+  knockback: [tone('noise', 0, 0, 0.08, 0.6), tone('square', 220, 0.04, 0.15, 0.35, 880)],
+  // Up and back down again.
+  reverse: [tone('sawtooth', 300, 0, 0.18, 0.3, 600), tone('sawtooth', 600, 0.18, 0.18, 0.3, 300)],
+  // Crackles of static.
+  jitter: [0, 0.07, 0.14, 0.21].map((at) => tone('noise', 0, at, 0.04, 0.5)),
+  // An icy shimmer.
+  freeze: [tone('triangle', 1760, 0, 0.6, 0.3), tone('triangle', 2349, 0.05, 0.55, 0.25)],
+  // A slow, drifting rise.
+  drift: [tone('sine', 330, 0, 0.8, 0.4, 392)],
+  // Three blips, each higher, as the cursor jumps.
+  teleport: [0, 0.12, 0.24].map((at, i) => tone('square', 660 * (1 + i * 0.5), at, 0.06, 0.3)),
+  // A beating magnetic hum.
+  magnet: [tone('sawtooth', 80, 0, 0.6, 0.3), tone('sawtooth', 86, 0, 0.6, 0.3)],
+  // Round and round between two notes.
+  orbit: [0, 0.1, 0.2, 0.3].map((at, i) => tone('sine', i % 2 ? 660 : 440, at, 0.1, 0.4)),
+  // A three-note chord, each cursor its own note.
+  decoys: [523, 659, 784].map((freq, i) => tone('triangle', freq, i * 0.06, 0.35, 0.3)),
+  // A woozy wobble.
+  drunk: [tone('sine', 300, 0, 0.25, 0.4, 250), tone('sine', 250, 0.25, 0.3, 0.4, 320)],
+  // A tiny squeak.
+  tiny: [tone('sine', 2000, 0, 0.1, 0.35, 2600)],
+  // A giant's stomp.
+  giant: [tone('sawtooth', 60, 0, 0.7, 0.4, 40), tone('noise', 0, 0, 0.15, 0.4)],
+  // A note and its late echoes.
+  delay: [0, 0.2, 0.4].map((at, i) => tone('sine', 440, at, 0.15, 0.45 / (i + 1))),
+  // A long fall.
+  fall: [tone('sine', 900, 0, 0.7, 0.4, 150)],
+  // A puff of smoke.
+  blur: [tone('noise', 0, 0, 0.5, 0.3)],
+  // A rising spiral.
+  spiral: [tone('triangle', 200, 0, 0.8, 0.4, 1200)],
+  // Boing, boing, boing.
+  bounce: [0, 0.12, 0.24].map((at, i) =>
+    tone('square', 300 + i * 150, at, 0.08, 0.3, 200 + i * 150)
+  ),
+  // A laser zap.
+  'axis-lock': [tone('square', 1200, 0, 0.2, 0.3, 400)],
+};
+
+/** A plain chirp for an attack ATTACK_SOUNDS does not know. */
+const FALLBACK_ATTACK: Sound = [tone('triangle', 440, 0, 0.2, 0.4, 660)];
+
+/** Every cat sounds a little different: up to half an octave either side. */
+export const pitchFor = (type: CatType) => 2 ** ((type.number - 10.5) / 19);
+
+const transpose = (sound: Sound, factor: number): Sound =>
+  sound.map((t) => ({
+    ...t,
+    freq: t.freq * factor,
+    ...(t.endFreq ? { endFreq: t.endFreq * factor } : {}),
+  }));
+
+export type CatSounds = { attack: Sound; wake: Sound; arrive: Sound };
+
+/** A cat type's three sounds. */
+export function soundsFor(type: CatType): CatSounds {
+  const pitch = pitchFor(type);
+  return {
+    attack: ATTACK_SOUNDS[type.effect.id] ?? FALLBACK_ATTACK,
+    // A stretching yawn up a fifth.
+    wake: transpose(
+      [tone('triangle', 392, 0, 0.18, 0.3, 587), tone('sine', 587, 0.16, 0.12, 0.2)],
+      pitch
+    ),
+    // A soft rising pop.
+    arrive: transpose([tone('sine', 196, 0, 0.25, 0.35, 392)], pitch),
+  };
+}
+
+// ------------------------------------------------------------- on/off, remembered
+
+export const SOUND_KEY = 'xenocats:sound';
+
+const listeners = new Set<() => void>();
+
+/** Whether sound is on: the stored choice, on unless switched off. */
+export function soundEnabled(): boolean {
+  try {
+    return window.localStorage.getItem(SOUND_KEY) !== 'off';
+  } catch {
+    return true;
+  }
+}
+
+export function setSoundEnabled(on: boolean) {
+  try {
+    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
+  } catch {
+    // Storage blocked: the choice lasts until the page is left.
+    memory = on;
+  }
+  for (const listener of listeners) listener();
+}
+
+let memory: boolean | null = null;
+
+/** For useSyncExternalStore: the stored choice, and changes to it (here or in another tab). */
+export function subscribeSound(onChange: () => void) {
+  listeners.add(onChange);
+  window.addEventListener('storage', onChange);
+  return () => {
+    listeners.delete(onChange);
+    window.removeEventListener('storage', onChange);
+  };
+}
+
+export const getSoundEnabled = () => memory ?? soundEnabled();
+
+// ------------------------------------------------------------------- the player
+
+type AudioContextLike = Pick<
+  AudioContext,
+  | 'currentTime'
+  | 'sampleRate'
+  | 'state'
+  | 'destination'
+  | 'resume'
+  | 'createOscillator'
+  | 'createGain'
+  | 'createBuffer'
+  | 'createBufferSource'
+>;
+
+export type SoundPlayer = ReturnType<typeof createSoundPlayer>;
+
+/**
+ * Plays sounds once the page has had a user gesture. `createContext` makes the
+ * AudioContext (tests pass their own); null, or one that throws, means no Web
+ * Audio: every call is then a silent no-op.
+ */
+export function createSoundPlayer(
+  createContext: () => AudioContextLike | null = defaultContext,
+  enabled: () => boolean = getSoundEnabled
+) {
+  let context: AudioContextLike | null = null;
+  let unlocked = false;
+  let noise: AudioBuffer | null = null;
+
+  function ensureContext(): AudioContextLike | null {
+    if (context) return context;
+    try {
+      context = createContext();
+    } catch {
+      context = null;
+    }
+    return context;
+  }
+
+  return {
+    /** The visitor has interacted with the page: audio may start. */
+    unlock() {
+      unlocked = true;
+      const ctx = ensureContext();
+      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
+    },
+
+    isUnlocked: () => unlocked,
+
+    /** Plays `sound` now, if sound is on, unlocked and available. Never throws. */
+    play(sound: Sound): boolean {
+      if (!unlocked || !enabled()) return false;
+      const ctx = ensureContext();
+      if (!ctx) return false;
+      // A suspended context's clock stands still: sounds queued now would all play
+      // at once later. Ask it to run, and skip this one.
+      if (ctx.state !== 'running') {
+        ctx.resume().catch(() => {});
+        return false;
+      }
+      try {
+        const start = ctx.currentTime + 0.01;
+        for (const t of sound) {
+          const gain = ctx.createGain();
+          const begin = start + t.at;
+          const end = begin + t.duration;
+          gain.gain.setValueAtTime(0.0001, begin);
+          gain.gain.exponentialRampToValueAtTime(Math.max(t.gain * 0.25, 0.0002), begin + 0.01);
+          gain.gain.exponentialRampToValueAtTime(0.0001, end);
+          gain.connect(ctx.destination);
+          if (t.wave === 'noise') {
+            noise ??= whiteNoise(ctx);
+            const source = ctx.createBufferSource();
+            source.buffer = noise;
+            source.connect(gain);
+            source.start(begin);
+            source.stop(end);
+          } else {
+            const osc = ctx.createOscillator();
+            osc.type = t.wave;
+            osc.frequency.setValueAtTime(t.freq, begin);
+            if (t.endFreq) osc.frequency.exponentialRampToValueAtTime(t.endFreq, end);
+            osc.connect(gain);
+            osc.start(begin);
+            osc.stop(end);
+          }
+        }
+        return true;
+      } catch {
+        return false;
+      }
+    },
+  };
+}
+
+function defaultContext(): AudioContextLike | null {
+  if (typeof window === 'undefined') return null;
+  const Ctor =
+    window.AudioContext ??
+    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
+  return Ctor ? new Ctor() : null;
+}
+
+function whiteNoise(ctx: AudioContextLike): AudioBuffer {
+  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
+  const data = buffer.getChannelData(0);
+  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
+  return buffer;
+}
diff --git a/tests/e2e/sound.spec.ts b/tests/e2e/sound.spec.ts
new file mode 100644
index 0000000..d746bec
--- /dev/null
+++ b/tests/e2e/sound.spec.ts
@@ -0,0 +1,103 @@
+import { type Page, expect, test } from '@playwright/test';
+import { SOUND_KEY } from '@/app/ui/xenocats/sounds';
+
+// The speaker toggle and the cats' sounds on /cats (no login, no database). Web
+// Audio is replaced by a stand-in that counts the tones it is asked to play.
+
+async function openCats(page: Page, sound?: 'on' | 'off') {
+  await page.addInitScript(
+    ({ key, sound }) => {
+      if (sound && !sessionStorage.getItem('seeded')) {
+        localStorage.setItem(key, sound);
+        sessionStorage.setItem('seeded', '1');
+      }
+      const w = window as unknown as { tones: number; AudioContext: unknown };
+      w.tones = 0;
+      const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
+      const node = { connect() {}, start() {}, stop() {} };
+      w.AudioContext = class {
+        currentTime = 0;
+        sampleRate = 8000;
+        state = 'running';
+        destination = {};
+        resume() {
+          return Promise.resolve();
+        }
+        createGain() {
+          return { ...node, gain: param };
+        }
+        createOscillator() {
+          w.tones++;
+          return { ...node, type: 'sine', frequency: param };
+        }
+        createBuffer(_c: number, n: number) {
+          return { getChannelData: () => new Float32Array(n) };
+        }
+        createBufferSource() {
+          w.tones++;
+          return { ...node, buffer: null };
+        }
+      };
+    },
+    { key: SOUND_KEY, sound }
+  );
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
+  // Hydrated once the fake cursor has taken over (a click before that is lost).
+  let nudge = 0;
+  await expect
+    .poll(async () => {
+      await page.mouse.move(640 + (nudge++ % 2), 400);
+      return page.locator('html').getAttribute('class');
+    })
+    .toContain('xenocat-cursor-hidden');
+}
+
+const tones = (page: Page) => page.evaluate(() => (window as unknown as { tones: number }).tones);
+
+test('the speaker toggle is on by default, works from the keyboard and is remembered', async ({
+  page,
+}) => {
+  await openCats(page);
+  const toggle = page.getByRole('button', { name: 'Cat sounds' });
+  await expect(toggle).toBeVisible();
+  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
+  // Reachable with Tab like any button, and switched with Enter or Space.
+  await toggle.focus();
+  await expect(toggle).toBeFocused();
+  await page.keyboard.press('Enter');
+  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
+  expect(await page.evaluate((key) => localStorage.getItem(key), SOUND_KEY)).toBe('off');
+  await page.reload();
+  await expect(page.getByRole('button', { name: 'Cat sounds' })).toHaveAttribute(
+    'aria-pressed',
+    'false'
+  );
+  await page.getByRole('button', { name: 'Cat sounds' }).focus();
+  await page.keyboard.press(' ');
+  await expect(page.getByRole('button', { name: 'Cat sounds' })).toHaveAttribute(
+    'aria-pressed',
+    'true'
+  );
+});
+
+test('a cat sounds as it arrives and attacks, after the first click', async ({ page }) => {
+  await openCats(page);
+  expect(await tones(page)).toBe(0);
+  await page.getByTestId('summon-void-tabby').click();
+  await expect.poll(() => tones(page)).toBeGreaterThan(0);
+});
+
+test('switched off, the cats are silent', async ({ page }) => {
+  await openCats(page, 'off');
+  await expect(page.getByRole('button', { name: 'Cat sounds' })).toHaveAttribute(
+    'aria-pressed',
+    'false'
+  );
+  await page.getByTestId('summon-void-tabby').click();
+  await expect(page.getByTestId('xenocat')).toHaveAttribute('data-phase', 'leaving', {
+    timeout: 8000,
+  });
+  expect(await tones(page)).toBe(0);
+});
diff --git a/tests/unit/xenocats/sounds.test.ts b/tests/unit/xenocats/sounds.test.ts
new file mode 100644
index 0000000..da93550
--- /dev/null
+++ b/tests/unit/xenocats/sounds.test.ts
@@ -0,0 +1,170 @@
+// @vitest-environment jsdom
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import {
+  ATTACK_SOUNDS,
+  SOUND_KEY,
+  type Sound,
+  createSoundPlayer,
+  getSoundEnabled,
+  setSoundEnabled,
+  soundsFor,
+} from '@/app/ui/xenocats/sounds';
+
+afterEach(() => {
+  localStorage.clear();
+  vi.restoreAllMocks();
+});
+
+const valid = (sound: Sound) => {
+  expect(sound.length).toBeGreaterThan(0);
+  for (const t of sound) {
+    if (t.wave !== 'noise') expect(t.freq).toBeGreaterThan(0);
+    expect(t.duration).toBeGreaterThan(0);
+    expect(t.at).toBeGreaterThanOrEqual(0);
+    expect(t.gain).toBeGreaterThan(0);
+    expect(t.gain).toBeLessThanOrEqual(1);
+  }
+};
+
+describe('every cat type has its sounds', () => {
+  it('an attack, a wake-up and an arrival, all playable', () => {
+    for (const type of CAT_TYPES) {
+      const sounds = soundsFor(type);
+      valid(sounds.attack);
+      valid(sounds.wake);
+      valid(sounds.arrive);
+      expect(ATTACK_SOUNDS[type.effect.id], type.id).toBe(sounds.attack);
+    }
+  });
+
+  it('every attack sounds different', () => {
+    const attacks = CAT_TYPES.map((type) => JSON.stringify(soundsFor(type).attack));
+    expect(new Set(attacks).size).toBe(CAT_TYPES.length);
+  });
+
+  it('every cat wakes and arrives at its own pitch', () => {
+    const wakes = CAT_TYPES.map((type) => soundsFor(type).wake[0].freq);
+    const arrivals = CAT_TYPES.map((type) => soundsFor(type).arrive[0].freq);
+    expect(new Set(wakes).size).toBe(CAT_TYPES.length);
+    expect(new Set(arrivals).size).toBe(CAT_TYPES.length);
+  });
+});
+
+/** A stand-in AudioContext that counts what it is asked to play. */
+function fakeContext() {
+  const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
+  const node = () => ({ connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
+  const ctx = {
+    currentTime: 0,
+    sampleRate: 8000,
+    state: 'suspended' as AudioContextState,
+    destination: {},
+    resume: vi.fn(() => {
+      ctx.state = 'running';
+      return Promise.resolve();
+    }),
+    oscillators: 0,
+    noises: 0,
+    createGain: () => ({ ...node(), gain: param() }),
+    createOscillator: () => {
+      ctx.oscillators++;
+      return { ...node(), type: 'sine', frequency: param() };
+    },
+    createBuffer: (_channels: number, length: number) => ({
+      getChannelData: () => new Float32Array(length),
+    }),
+    createBufferSource: () => {
+      ctx.noises++;
+      return { ...node(), buffer: null };
+    },
+  };
+  return ctx;
+}
+
+const beep: Sound = [{ wave: 'sine', freq: 440, at: 0, duration: 0.1, gain: 0.5 }];
+
+describe('the player', () => {
+  it('plays nothing before the first gesture, and does not even make a context', () => {
+    const make = vi.fn(fakeContext);
+    const player = createSoundPlayer(make as never, () => true);
+    expect(player.play(beep)).toBe(false);
+    expect(make).not.toHaveBeenCalled();
+  });
+
+  it('after a gesture it resumes the context and plays every tone', () => {
+    const ctx = fakeContext();
+    const player = createSoundPlayer(
+      () => ctx as never,
+      () => true
+    );
+    player.unlock();
+    expect(ctx.resume).toHaveBeenCalled();
+    const knockback = ATTACK_SOUNDS.knockback;
+    expect(player.play(knockback)).toBe(true);
+    expect(ctx.oscillators).toBe(knockback.filter((t) => t.wave !== 'noise').length);
+    expect(ctx.noises).toBe(knockback.filter((t) => t.wave === 'noise').length);
+  });
+
+  it('queues nothing on a context that is still suspended, and asks it to run', () => {
+    const ctx = fakeContext();
+    ctx.resume = vi.fn(() => Promise.resolve()); // stays suspended
+    const player = createSoundPlayer(
+      () => ctx as never,
+      () => true
+    );
+    player.unlock();
+    expect(player.play(beep)).toBe(false);
+    expect(ctx.oscillators).toBe(0);
+    expect(ctx.resume).toHaveBeenCalledTimes(2);
+  });
+
+  it('plays nothing while sound is switched off', () => {
+    const ctx = fakeContext();
+    const player = createSoundPlayer(
+      () => ctx as never,
+      () => false
+    );
+    player.unlock();
+    expect(player.play(beep)).toBe(false);
+    expect(ctx.oscillators).toBe(0);
+  });
+
+  it('fails silently without Web Audio, or when it throws', () => {
+    const none = createSoundPlayer(
+      () => null,
+      () => true
+    );
+    none.unlock();
+    expect(none.play(beep)).toBe(false);
+    const throwing = createSoundPlayer(
+      () => {
+        throw new Error('no audio');
+      },
+      () => true
+    );
+    expect(() => throwing.unlock()).not.toThrow();
+    expect(throwing.play(beep)).toBe(false);
+    const broken = fakeContext();
+    broken.createOscillator = () => {
+      throw new Error('closed');
+    };
+    const player = createSoundPlayer(
+      () => broken as never,
+      () => true
+    );
+    player.unlock();
+    expect(player.play(beep)).toBe(false);
+  });
+});
+
+describe('the on/off switch', () => {
+  it('is on by default, and remembers off', () => {
+    expect(getSoundEnabled()).toBe(true);
+    setSoundEnabled(false);
+    expect(localStorage.getItem(SOUND_KEY)).toBe('off');
+    expect(getSoundEnabled()).toBe(false);
+    setSoundEnabled(true);
+    expect(getSoundEnabled()).toBe(true);
+  });
+});
~~~~

</details>

#### T5 — `night-2026-10-01-t5-field-guide`

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

<details><summary>Code:  7 files changed, 479 insertions(+), 101 deletions(-)</summary>

~~~~diff
diff --git a/app/ui/xenocats/cat-gallery.tsx b/app/ui/xenocats/cat-gallery.tsx
index 9b5eee1..01c8ccc 100644
--- a/app/ui/xenocats/cat-gallery.tsx
+++ b/app/ui/xenocats/cat-gallery.tsx
@@ -1,6 +1,6 @@
 'use client';
 
-import { useState } from 'react';
+import { memo, useCallback, useState, useSyncExternalStore } from 'react';
 import { Button } from '@/app/ui/button';
 import { XenocatCatsProvider, useXenocats } from './cat-layer';
 import { catArt } from './cat-art';
@@ -8,6 +8,7 @@ import { CatSprite } from './cat-sprite';
 import { CAT_TYPES, type CatType } from './cat-types';
 import { XenocatCursorProvider } from './fake-cursor';
 import Fight from './fight';
+import { entryFor, getGuide, getServerGuide, isEmptyGuide, subscribeGuide } from './field-guide';
 
 /**
  * Every cat type with two Summon buttons: awake, to pounce as soon as it arrives,
@@ -31,20 +32,40 @@ function Roster({ disabled }: { disabled: boolean }) {
   const cats = useXenocats();
   const [status, setStatus] = useState('');
 
-  const summon = (type: CatType, asleep: boolean) => {
-    // Refused when five cats are already here, or when there is no free spot.
-    const message = cats.summon(type.id, { asleep })
-      ? asleep
-        ? `${type.name} is on its way, and will nap before it pounces.`
-        : `${type.name} is on its way.`
-      : 'No room for another cat right now. Wait for one to leave.';
-    // Clear first, so a screen reader announces the same message again.
-    setStatus('');
-    requestAnimationFrame(() => setStatus(message));
-  };
+  const summon = useCallback(
+    (type: CatType, asleep: boolean) => {
+      // Refused when five cats are already here, or when there is no free spot.
+      const message = cats.summon(type.id, { asleep })
+        ? asleep
+          ? `${type.name} is on its way, and will nap before it pounces.`
+          : `${type.name} is on its way.`
+        : 'No room for another cat right now. Wait for one to leave.';
+      // Clear first, so a screen reader announces the same message again.
+      setStatus('');
+      requestAnimationFrame(() => setStatus(message));
+    },
+    [cats]
+  );
+
+  const guide = useSyncExternalStore(subscribeGuide, getGuide, getServerGuide);
+  // A tamed cat was met, even if it was tamed before the guide counted meetings.
+  const metCount = CAT_TYPES.filter((type) => {
+    const entry = entryFor(guide, type.id);
+    return entry.met > 0 || entry.tamed > 0;
+  }).length;
 
   return (
     <>
+      <section aria-labelledby="guide-heading" className="mb-4">
+        <h2 id="guide-heading" className="font-display text-2xl font-semibold text-cream">
+          Field guide
+        </h2>
+        <p data-testid="guide-summary" className="mt-2 min-h-[3.75rem] max-w-2xl text-sm text-aura">
+          {isEmptyGuide(guide)
+            ? "Your field guide is empty: you haven't met any cats yet. They turn up on the dashboard while you work, or summon one below to meet it. Each card will keep count of how often you've met that cat, survived its attack and tamed it."
+            : `You have met ${metCount} of the ${CAT_TYPES.length} cats. Each card counts how often you've met that cat, survived its attack and tamed it.`}
+        </p>
+      </section>
       <p
         role="status"
         aria-live="polite"
@@ -55,54 +76,111 @@ function Roster({ disabled }: { disabled: boolean }) {
       </p>
       <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
         {CAT_TYPES.map((type) => (
-          <li
+          <CatCard
             key={type.id}
-            data-testid={`cat-card-${type.id}`}
-            data-xenocat-card
-            className="flex flex-col rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-aura/60"
-          >
-            <div className="flex items-center gap-4">
-              <div className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-void/70">
-                <CatSprite
-                  palette={type.palette}
-                  look={type.look}
-                  pose="awake"
-                  size={64}
-                  art={catArt(type.id, 'awake')}
-                />
-              </div>
-              <div>
-                <p className="text-xs font-medium uppercase tracking-wide text-aura">
-                  No. {type.number}
-                </p>
-                <h2 className="text-lg font-semibold text-white">{type.name}</h2>
-                <p className="text-sm font-medium text-plasma">{type.effect.name}</p>
-              </div>
-            </div>
-            <p className="mt-3 grow text-sm text-aura">{type.effect.description}</p>
-            <div className="mt-4 grid grid-cols-2 gap-2">
-              <Button
-                className="justify-center whitespace-nowrap px-1 text-[13px]"
-                data-testid={`summon-${type.id}`}
-                aria-label={`Summon ${type.name} awake`}
-                disabled={disabled}
-                onClick={() => summon(type, false)}
-              >
-                Summon awake
-              </Button>
-              <Button
-                className="justify-center whitespace-nowrap px-1 text-[13px]"
-                data-testid={`summon-asleep-${type.id}`}
-                aria-label={`Summon ${type.name} asleep`}
-                disabled={disabled}
-                onClick={() => summon(type, true)}
-              >
-                Summon asleep
-              </Button>
-            </div>
-          </li>
+            type={type}
+            {...entryFor(guide, type.id)}
+            disabled={disabled}
+            onSummon={summon}
+          />
         ))}
       </ul>
     </>
   );
 }
+
+/** One cat's card. Memoised: a count changing re-renders only that cat's card. */
+const CatCard = memo(function CatCard({
+  type,
+  met,
+  survived,
+  tamed,
+  disabled,
+  onSummon,
+}: {
+  type: CatType;
+  met: number;
+  survived: number;
+  tamed: number;
+  disabled: boolean;
+  onSummon: (type: CatType, asleep: boolean) => void;
+}) {
+  return (
+    <li
+      data-testid={`cat-card-${type.id}`}
+      data-xenocat-card
+      className="flex flex-col rounded-2xl border border-line bg-panel p-4 transition-colors hover:border-aura/60"
+    >
+      <div className="flex items-center gap-4">
+        <div className="flex h-20 w-20 flex-none items-center justify-center rounded-xl bg-void/70">
+          <CatSprite
+            palette={type.palette}
+            look={type.look}
+            pose="awake"
+            size={64}
+            art={catArt(type.id, 'awake')}
+          />
+        </div>
+        <div>
+          <p className="text-xs font-medium uppercase tracking-wide text-aura">No. {type.number}</p>
+          <h2 className="text-lg font-semibold text-white">{type.name}</h2>
+          <p className="text-sm font-medium text-plasma">{type.effect.name}</p>
+        </div>
+      </div>
+      <p className="mt-3 grow text-sm text-aura">{type.effect.description}</p>
+      <GuideEntry met={met} survived={survived} tamed={tamed} />
+      <div className="mt-4 grid grid-cols-2 gap-2">
+        <Button
+          className="justify-center whitespace-nowrap px-1 text-[13px]"
+          data-testid={`summon-${type.id}`}
+          aria-label={`Summon ${type.name} awake`}
+          disabled={disabled}
+          onClick={() => onSummon(type, false)}
+        >
+          Summon awake
+        </Button>
+        <Button
+          className="justify-center whitespace-nowrap px-1 text-[13px]"
+          data-testid={`summon-asleep-${type.id}`}
+          aria-label={`Summon ${type.name} asleep`}
+          disabled={disabled}
+          onClick={() => onSummon(type, true)}
+        >
+          Summon asleep
+        </Button>
+      </div>
+    </li>
+  );
+});
+
+/**
+ * One card's field-guide counts, or a note that this cat has not been met yet. Both
+ * are the same height, so meeting a cat never moves the card's buttons.
+ */
+function GuideEntry({ met, survived, tamed }: { met: number; survived: number; tamed: number }) {
+  if (met === 0 && survived === 0 && tamed === 0) {
+    return (
+      <p
+        data-testid="guide-entry"
+        className="mt-3 flex h-14 items-center justify-center rounded-lg bg-void/60 text-xs italic text-aura/80"
+      >
+        Not met yet.
+      </p>
+    );
+  }
+  const stats = [
+    ['Met', met],
+    ['Attacks survived', survived],
+    ['Tamed', tamed],
+  ] as const;
+  return (
+    <dl data-testid="guide-entry" className="mt-3 grid h-14 grid-cols-3 gap-2 text-center">
+      {stats.map(([label, value]) => (
+        <div key={label} className="flex flex-col justify-center rounded-lg bg-void/60 px-1">
+          <dt className="text-[11px] leading-tight text-aura">{label}</dt>
+          <dd className="text-base font-semibold text-cream">{value}</dd>
+        </div>
+      ))}
+    </dl>
+  );
+}
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index f75af69..a0d5e24 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -18,6 +18,7 @@ import { CatSprite } from './cat-sprite';
 import { CAT_TYPES, type CatType } from './cat-types';
 import type { CatConfig } from './config';
 import { useXenocatCursor } from './fake-cursor';
+import { recordStat } from './field-guide';
 import {
   type CatSounds,
   createSoundPlayer,
@@ -116,7 +117,10 @@ export function XenocatCatsProvider({
         phases.set(cat.id, cat.phase);
         const type = typesRef.current.find((t) => t.id === cat.typeId);
         if (!type) continue;
-        if (cat.phase === 'appearing') player.play(soundsFor(type).arrive);
+        if (cat.phase === 'appearing') {
+          player.play(soundsFor(type).arrive);
+          recordStat(type.id, 'met');
+        }
         if (cat.phase === 'waking') player.play(soundsFor(type).wake);
       }
       for (const id of phases.keys()) if (!seen.has(id)) phases.delete(id);
@@ -135,6 +139,7 @@ export function XenocatCatsProvider({
         if (cursor.isHidden()) return false;
         if (!cursor.attack(type.effect, centre)) return false;
         player.play(soundsFor(type).attack);
+        recordStat(type.id, 'survived');
         return true;
       });
       if (changed) setCats(snapshot(engine));
diff --git a/app/ui/xenocats/field-guide.ts b/app/ui/xenocats/field-guide.ts
new file mode 100644
index 0000000..8e9a1be
--- /dev/null
+++ b/app/ui/xenocats/field-guide.ts
@@ -0,0 +1,123 @@
+// The cat field guide: what this visitor has seen of each cat type, kept in
+// localStorage. Times met (a cat of that type turned up), attacks survived (its
+// attack hit you and you lived), and tamed (the Taming collection, taming.ts).
+//
+// Pure parsing and counting, plus a tiny store for React (useSyncExternalStore)
+// that notifies this tab when a count changes and other tabs through `storage`.
+
+import type { CatType } from './cat-types';
+import { CAT_TYPES } from './cat-types';
+import { TAMED_KEY, type TamedCollection, addTamed, parseCollection } from './taming';
+
+export const GUIDE_KEY = 'xenocats:guide';
+
+export type TypeStats = { met: number; survived: number };
+export type GuideStats = Readonly<Record<string, TypeStats>>;
+
+const count = (value: unknown) =>
+  Number.isInteger(value) && (value as number) > 0 ? (value as number) : 0;
+
+/** Reads stored stats; anything malformed or not a known type is dropped. */
+export function parseStats(raw: string | null, types: readonly CatType[]): GuideStats {
+  if (!raw) return {};
+  let value: unknown;
+  try {
+    value = JSON.parse(raw);
+  } catch {
+    return {};
+  }
+  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
+  const known = new Set(types.map((type) => type.id));
+  const stats: Record<string, TypeStats> = {};
+  for (const [id, entry] of Object.entries(value)) {
+    if (!known.has(id) || typeof entry !== 'object' || entry === null) continue;
+    const { met, survived } = entry as Record<string, unknown>;
+    const parsed = { met: count(met), survived: count(survived) };
+    if (parsed.met > 0 || parsed.survived > 0) stats[id] = parsed;
+  }
+  return stats;
+}
+
+/** The stats with one more `field` for `typeId`. */
+export function addStat(stats: GuideStats, typeId: string, field: keyof TypeStats): GuideStats {
+  const current = stats[typeId] ?? { met: 0, survived: 0 };
+  return { ...stats, [typeId]: { ...current, [field]: current[field] + 1 } };
+}
+
+export type Guide = { stats: GuideStats; tamed: TamedCollection };
+
+/** One cat type's line in the guide. */
+export const entryFor = (guide: Guide, typeId: string) => ({
+  met: guide.stats[typeId]?.met ?? 0,
+  survived: guide.stats[typeId]?.survived ?? 0,
+  tamed: guide.tamed[typeId] ?? 0,
+});
+
+/** True for a visitor who has not met, survived or tamed any cat yet. */
+export const isEmptyGuide = (guide: Guide) =>
+  Object.keys(guide.stats).length === 0 && Object.keys(guide.tamed).length === 0;
+
+// ------------------------------------------------------------------ the store
+
+const EMPTY: Guide = { stats: {}, tamed: {} };
+const listeners = new Set<() => void>();
+let cached: { raw: string; guide: Guide } | null = null;
+
+function read(key: string): string | null {
+  try {
+    return window.localStorage.getItem(key);
+  } catch {
+    return null;
+  }
+}
+
+function write(key: string, value: string) {
+  try {
+    window.localStorage.setItem(key, value);
+  } catch {
+    // Storage blocked or full: the guide just doesn't remember this one.
+  }
+}
+
+/** The guide as stored; the same object until something changes (for React). */
+export function getGuide(): Guide {
+  const stats = read(GUIDE_KEY);
+  const tamed = read(TAMED_KEY);
+  const raw = `${stats}\u0000${tamed}`;
+  if (cached?.raw !== raw) {
+    cached = {
+      raw,
+      guide: { stats: parseStats(stats, CAT_TYPES), tamed: parseCollection(tamed, CAT_TYPES) },
+    };
+  }
+  return cached.guide;
+}
+
+export const getServerGuide = () => EMPTY;
+
+export function subscribeGuide(onChange: () => void) {
+  listeners.add(onChange);
+  window.addEventListener('storage', onChange);
+  return () => {
+    listeners.delete(onChange);
+    window.removeEventListener('storage', onChange);
+  };
+}
+
+const notify = () => {
+  for (const listener of listeners) listener();
+};
+
+/** A cat of `typeId` turned up, or its attack hit and was survived. */
+export function recordStat(typeId: string, field: keyof TypeStats) {
+  if (!CAT_TYPES.some((type) => type.id === typeId)) return;
+  write(GUIDE_KEY, JSON.stringify(addStat(getGuide().stats, typeId, field)));
+  notify();
+}
+
+/** A cat of `typeId` was tamed: one more in the collection. */
+export function recordTamed(typeId: string) {
+  if (!CAT_TYPES.some((type) => type.id === typeId)) return;
+  write(TAMED_KEY, JSON.stringify(addTamed(getGuide().tamed, typeId)));
+  notify();
+}
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index c738bef..e8a0464 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -19,14 +19,8 @@ import {
   createGameClock,
   createSurvival,
 } from './survival';
-import {
-  TAMED_KEY,
-  type Taming,
-  type TamingSnapshot,
-  addTamed,
-  createTaming,
-  parseCollection,
-} from './taming';
+import { type Taming, type TamingSnapshot, createTaming } from './taming';
+import { getGuide, getServerGuide, recordStat, recordTamed, subscribeGuide } from './field-guide';
 
 // Fight a cat, on the /cats page. Start asks for pointer lock: the browser hides the
 // system pointer and the game owns the pointer's position, so the cats attack that
@@ -50,30 +44,6 @@ type Game = {
 
 const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
 
-function readCollectionRaw(): string | null {
-  try {
-    return window.localStorage.getItem(TAMED_KEY);
-  } catch {
-    return null;
-  }
-}
-
-/** How many cats have been tamed in all, from localStorage. */
-function readTamedTotal(): number {
-  const collection = parseCollection(readCollectionRaw(), CAT_TYPES);
-  return Object.values(collection).reduce((sum, count) => sum + count, 0);
-}
-
-/** Adds a tamed cat to the stored collection. */
-function storeTamed(typeId: string) {
-  try {
-    const collection = parseCollection(readCollectionRaw(), CAT_TYPES);
-    window.localStorage.setItem(TAMED_KEY, JSON.stringify(addTamed(collection, typeId)));
-  } catch {
-    // Storage blocked or full: the cat is tamed for this game only.
-  }
-}
-
 function readBest(): number | null {
   try {
     const value = Number(window.localStorage.getItem(SURVIVAL_BEST_KEY));
@@ -160,7 +130,8 @@ export default function Fight({
   const [tameSnap, setTameSnap] = useState<TamingSnapshot | null>(null);
   // Read on every render, so what a game just wrote shows at once.
   const best = useSyncExternalStore(subscribeBest, readBest, () => null);
-  const tamedTotal = useSyncExternalStore(subscribeBest, readTamedTotal, () => 0);
+  const guide = useSyncExternalStore(subscribeGuide, getGuide, getServerGuide);
+  const tamedTotal = Object.values(guide.tamed).reduce((sum, count) => sum + count, 0);
   const [message, setMessage] = useState('');
   const gameRef = useRef<Game | null>(null);
   const phaseRef = useRef<Phase>('idle');
@@ -284,6 +255,7 @@ export default function Fight({
         if (heard.has(cat.id)) continue;
         heard.add(cat.id);
         cats.sound(cat.typeId, 'arrive');
+        recordStat(cat.typeId, 'met');
       }
     };
 
@@ -318,7 +290,7 @@ export default function Fight({
         if (game.kind === 'taming') {
           const tamed = game.taming.tick(now, at, CAT_CONFIG.maxCats - cats.count());
           if (tamed) {
-            storeTamed(tamed);
+            recordTamed(tamed);
             setMessage(`You tamed ${catTypeById(tamed)?.name ?? 'a cat'}!`);
           }
           const snapshot = game.taming.snapshot(now);
@@ -343,6 +315,10 @@ export default function Fight({
             if (hit) cats.sound(type.id, 'attack');
           }
           const snapshot = game.survival.snapshot();
+          // An attack that did not end the game was survived.
+          if (snapshot.status === 'playing') {
+            for (const cat of landed) recordStat(cat.typeId, 'survived');
+          }
           hearArrivals(snapshot.cats);
           moveCats(snapshot.cats);
           const { status, lives, wave, score } = snapshot;
diff --git a/tests/e2e/cats.spec.ts b/tests/e2e/cats.spec.ts
index f2f882a..6ae231d 100644
--- a/tests/e2e/cats.spec.ts
+++ b/tests/e2e/cats.spec.ts
@@ -489,10 +489,22 @@ test('an attack scrambles the text near the pointer for the eye only, then resto
 }) => {
   await openCats(page);
   const card = page.getByTestId('cat-card-decoy-burmese');
-  const texts = await card.evaluate((el) =>
-    Array.from(el.querySelectorAll('*'), (child) => child.textContent)
-  );
-  const before = await card.evaluate((el) => el.outerHTML);
+  // The card minus its field-guide counts, which rightly change as the cat is met
+  // and attacks (field-guide.spec.ts).
+  const textsOf = () =>
+    card.evaluate((el) => {
+      const copy = el.cloneNode(true) as Element;
+      copy.querySelector('[data-testid="guide-entry"]')?.remove();
+      return Array.from(copy.querySelectorAll('*'), (child) => child.textContent);
+    });
+  const htmlOf = () =>
+    card.evaluate((el) => {
+      const copy = el.cloneNode(true) as Element;
+      copy.querySelector('[data-testid="guide-entry"]')?.remove();
+      return copy.outerHTML;
+    });
+  const texts = await textsOf();
+  const before = await htmlOf();
   await summon(page, 'decoy-burmese');
   await expect(fakeCursor(page)).toHaveAttribute('data-effect', 'decoys');
   const scrambled = card.locator('[data-xenocat-hit="text"]').first();
@@ -501,11 +513,15 @@ test('an attack scrambles the text near the pointer for the eye only, then resto
   expect(shown).not.toBe(await scrambled.textContent());
   // The real text, which assistive technology reads, never changes.
   await expect(card.getByRole('heading', { name: 'Decoy Burmese' })).toBeVisible();
-  expect(
-    await card.evaluate((el) => Array.from(el.querySelectorAll('*'), (child) => child.textContent))
-  ).toEqual(texts);
+  expect(await textsOf()).toEqual(texts);
   // After the effect (5 s) nothing is left of it.
   await expect(card.locator('[data-xenocat-hit]')).toHaveCount(0, { timeout: 8000 });
-  // The card is exactly as it was before the cat came.
-  expect(await card.evaluate((el) => el.outerHTML)).toBe(before);
+  // The card is exactly as it was before the cat came, and its guide entry carries
+  // nothing of the effect either.
+  expect(await htmlOf()).toBe(before);
+  await expect(
+    card
+      .getByTestId('guide-entry')
+      .locator('xpath=descendant-or-self::*[@style or @data-xenocat-hit-text]')
+  ).toHaveCount(0);
 });
diff --git a/tests/e2e/field-guide.spec.ts b/tests/e2e/field-guide.spec.ts
new file mode 100644
index 0000000..fb08fe1
--- /dev/null
+++ b/tests/e2e/field-guide.spec.ts
@@ -0,0 +1,70 @@
+import { type Page, expect, test } from '@playwright/test';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { GUIDE_KEY } from '@/app/ui/xenocats/field-guide';
+import { TAMED_KEY } from '@/app/ui/xenocats/taming';
+
+// The field guide on /cats (no login, no database): per-cat counts kept in
+// localStorage, and the wording for a visitor who has met no cat yet.
+
+async function openCats(page: Page, stored?: Record<string, string>) {
+  if (stored) {
+    await page.addInitScript((items) => {
+      if (sessionStorage.getItem('seeded')) return;
+      for (const [key, value] of Object.entries(items)) localStorage.setItem(key, value);
+      sessionStorage.setItem('seeded', '1');
+    }, stored);
+  }
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await expect(page.getByRole('heading', { name: 'Field guide' })).toBeVisible();
+  let nudge = 0;
+  await expect
+    .poll(async () => {
+      await page.mouse.move(640 + (nudge++ % 2), 400);
+      return page.locator('html').getAttribute('class');
+    })
+    .toContain('xenocat-cursor-hidden');
+}
+
+const entry = (page: Page, id: string) =>
+  page.getByTestId(`cat-card-${id}`).getByTestId('guide-entry');
+
+test('a new visitor sees an empty guide, every cat not met yet', async ({ page }) => {
+  await openCats(page);
+  await expect(page.getByTestId('guide-summary')).toContainText(
+    "Your field guide is empty: you haven't met any cats yet."
+  );
+  for (const type of CAT_TYPES) await expect(entry(page, type.id)).toHaveText('Not met yet.');
+});
+
+test('meeting a cat and surviving its attack is counted, and kept', async ({ page }) => {
+  test.setTimeout(30_000);
+  await openCats(page);
+  const button = page.getByTestId('summon-void-tabby');
+  await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
+  const box = (await button.boundingBox())!;
+  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
+  await button.click();
+  const voidTabby = entry(page, 'void-tabby');
+  await expect(voidTabby.getByText('Met').locator('xpath=..')).toContainText('1');
+  // Its attack (vanish) hits the cursor once it has arrived.
+  await expect(voidTabby.getByText('Attacks survived').locator('xpath=..')).toContainText('1', {
+    timeout: 10_000,
+  });
+  await expect(page.getByTestId('guide-summary')).toHaveText(
+    "You have met 1 of the 20 cats. Each card counts how often you've met that cat, survived its attack and tamed it."
+  );
+  await page.reload();
+  await expect(entry(page, 'void-tabby').getByText('Met').locator('xpath=..')).toContainText('1');
+});
+
+test('shows stored counts, tamed cats included', async ({ page }) => {
+  await openCats(page, {
+    [GUIDE_KEY]: JSON.stringify({ 'gravi-coon': { met: 4, survived: 3 } }),
+    [TAMED_KEY]: JSON.stringify({ 'gravi-coon': 2, 'cryo-persian': 1 }),
+  });
+  const gravi = entry(page, 'gravi-coon');
+  await expect(gravi.locator('dd')).toHaveText(['4', '3', '2']);
+  await expect(entry(page, 'cryo-persian').locator('dd')).toHaveText(['0', '0', '1']);
+  await expect(entry(page, 'void-tabby')).toHaveText('Not met yet.');
+});
diff --git a/tests/unit/xenocats/field-guide.test.ts b/tests/unit/xenocats/field-guide.test.ts
new file mode 100644
index 0000000..9905dbb
--- /dev/null
+++ b/tests/unit/xenocats/field-guide.test.ts
@@ -0,0 +1,110 @@
+// @vitest-environment jsdom
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import {
+  GUIDE_KEY,
+  addStat,
+  entryFor,
+  getGuide,
+  isEmptyGuide,
+  parseStats,
+  recordStat,
+  recordTamed,
+  subscribeGuide,
+} from '@/app/ui/xenocats/field-guide';
+import { TAMED_KEY } from '@/app/ui/xenocats/taming';
+
+afterEach(() => {
+  localStorage.clear();
+  vi.restoreAllMocks();
+});
+
+describe('stats', () => {
+  it('count per type and field', () => {
+    let stats = addStat({}, 'void-tabby', 'met');
+    stats = addStat(stats, 'void-tabby', 'met');
+    stats = addStat(stats, 'void-tabby', 'survived');
+    stats = addStat(stats, 'gravi-coon', 'met');
+    expect(stats).toEqual({
+      'void-tabby': { met: 2, survived: 1 },
+      'gravi-coon': { met: 1, survived: 0 },
+    });
+  });
+
+  it('read back what was stored, dropping anything malformed or unknown', () => {
+    expect(parseStats(null, CAT_TYPES)).toEqual({});
+    expect(parseStats('{', CAT_TYPES)).toEqual({});
+    expect(parseStats('[]', CAT_TYPES)).toEqual({});
+    expect(
+      parseStats(
+        JSON.stringify({
+          'void-tabby': { met: 3, survived: 1 },
+          'gravi-coon': { met: -2, survived: 'x' },
+          'cryo-persian': 7,
+          'no-such-cat': { met: 1, survived: 1 },
+          'pulsar-siamese': { met: 1.5, survived: 2 },
+        }),
+        CAT_TYPES
+      )
+    ).toEqual({
+      'void-tabby': { met: 3, survived: 1 },
+      'pulsar-siamese': { met: 0, survived: 2 },
+    });
+  });
+});
+
+describe('the guide', () => {
+  it('is empty for a new visitor, every cat at zero', () => {
+    const guide = getGuide();
+    expect(isEmptyGuide(guide)).toBe(true);
+    for (const type of CAT_TYPES) {
+      expect(entryFor(guide, type.id)).toEqual({ met: 0, survived: 0, tamed: 0 });
+    }
+  });
+
+  it('records meetings, survived attacks and tamed cats, and tells subscribers', () => {
+    const onChange = vi.fn();
+    const unsubscribe = subscribeGuide(onChange);
+    recordStat('void-tabby', 'met');
+    recordStat('void-tabby', 'survived');
+    recordTamed('void-tabby');
+    recordTamed('void-tabby');
+    expect(onChange).toHaveBeenCalledTimes(4);
+    const guide = getGuide();
+    expect(isEmptyGuide(guide)).toBe(false);
+    expect(entryFor(guide, 'void-tabby')).toEqual({ met: 1, survived: 1, tamed: 2 });
+    expect(JSON.parse(localStorage.getItem(GUIDE_KEY)!)).toEqual({
+      'void-tabby': { met: 1, survived: 1 },
+    });
+    expect(JSON.parse(localStorage.getItem(TAMED_KEY)!)).toEqual({ 'void-tabby': 2 });
+    unsubscribe();
+    recordStat('void-tabby', 'met');
+    expect(onChange).toHaveBeenCalledTimes(4);
+  });
+
+  it('ignores unknown cat types', () => {
+    recordStat('no-such-cat', 'met');
+    recordTamed('no-such-cat');
+    expect(localStorage.length).toBe(0);
+  });
+
+  it('returns the same object until something changes (as React requires)', () => {
+    const first = getGuide();
+    expect(getGuide()).toBe(first);
+    recordStat('gravi-coon', 'met');
+    const second = getGuide();
+    expect(second).not.toBe(first);
+    expect(getGuide()).toBe(second);
+  });
+
+  it('carries on without storage', () => {
+    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
+      throw new Error('blocked');
+    });
+    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
+      throw new Error('blocked');
+    });
+    expect(() => recordStat('void-tabby', 'met')).not.toThrow();
+    expect(isEmptyGuide(getGuide())).toBe(true);
+  });
+});
~~~~

</details>

#### TC1 — `night-2026-10-01-c1-checkpoint`

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

<details><summary>Code:  6 files changed, 336 insertions(+), 35 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 120002f..dcbefa3 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -24,11 +24,13 @@ jobs:
       - run: npm run lint
       - name: Type check
         run: npx next typegen && npx tsc --noEmit
-      # The unit tests run in three named groups, each even if an earlier one failed,
+      # The unit tests run in named groups, each even if an earlier one failed,
       # so a failure is identifiable from the job's step names alone.
       - name: Unit tests (dashboard)
         if: ${{ !cancelled() }}
-        run: npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
+        run: >-
+          npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
+          tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher
       - name: Unit tests (cats, Node)
         if: ${{ !cancelled() }}
         run: >-
@@ -39,7 +41,31 @@ jobs:
         if: ${{ !cancelled() }}
         run: >-
           npx vitest run tests/unit/xenocats/cursor-kind tests/unit/xenocats/fake-cursor
-          tests/unit/xenocats/cat-layer
+          tests/unit/xenocats/cat-layer tests/unit/xenocats/cat-art tests/unit/xenocats/cat-sprite
+      - name: Unit tests (cats, games, page, sound)
+        if: ${{ !cancelled() }}
+        run: >-
+          npx vitest run tests/unit/xenocats/survival tests/unit/xenocats/locked-pointer
+          tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
+          tests/unit/xenocats/field-guide
+      # A test file in no group would never run: each unit test must be named in a
+      # group above, each browser test in a group of both browser jobs below.
+      - name: Every test file is in a group
+        if: ${{ !cancelled() }}
+        run: |
+          missing=0
+          for file in tests/unit/*.test.ts* tests/unit/xenocats/*.test.ts* tests/e2e/*.spec.ts; do
+            name="${file%.test.ts*}"
+            name="${name%.spec.ts}"
+            need=1
+            case "$file" in tests/e2e/*) need=2 ;; esac
+            found=$(grep -cE "(^|[[:space:]])${name}([[:space:]]|$)" .github/workflows/ci.yml || true)
+            if [ "$found" -lt "$need" ]; then
+              echo "::error file=$file::$file is in no test group in ci.yml (named $found times, needs $need)"
+              missing=1
+            fi
+          done
+          exit "$missing"
 
   build:
     name: Build + browser tests (production)
@@ -72,16 +98,47 @@ jobs:
           test "$(sudo -u postgres psql -Atc 'SHOW ssl')" = on
       - run: npm run db:migrate && npm run db:seed
       - run: npm run build
-      - run: npx playwright install --with-deps chromium
-      - name: Browser tests against next start
-        run: npm run test:e2e
+      - id: install
+        run: npx playwright install --with-deps chromium
+      # The browser tests run in named groups, each even if an earlier one failed,
+      # so a failure is identifiable from the job's step names alone (but not when
+      # the build or the browser install failed). Each keeps its own report and
+      # traces: a Playwright run clears the previous run's.
+      - name: Browser tests against next start (smoke, branding, dashboard)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
+          --output test-results/smoke
+        env:
+          E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
+      - name: Browser tests against next start (cats)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: npx playwright test tests/e2e/cats --output test-results/cats
+        env:
+          E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
+      - name: Browser tests against next start (fight)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: npx playwright test tests/e2e/fight --output test-results/fight
         env:
           E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/fight
+      - name: Browser tests against next start (sound, field guide)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/sound tests/e2e/field-guide
+          --output test-results/sound
+        env:
+          E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/sound
       - uses: actions/upload-artifact@v4
         if: failure()
         with:
           name: playwright-report-production
-          path: playwright-report/
+          path: |
+            playwright-report/
+            test-results/
           retention-days: 7
 
   e2e:
@@ -110,12 +167,39 @@ jobs:
           sudo systemctl start postgresql.service
           sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres'"
           test "$(sudo -u postgres psql -Atc 'SHOW ssl')" = on
-      - run: npx playwright install --with-deps chromium
-      # Needs no db:migrate: the tests rebuild their own xenocats_test schema.
-      - run: npm run test:e2e
+      - id: install
+        run: npx playwright install --with-deps chromium
+      # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
+      # groups, each with its own report and traces, as in the build job.
+      - name: Browser tests (smoke, branding, dashboard)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
+          --output test-results/smoke
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
+      - name: Browser tests (cats)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: npx playwright test tests/e2e/cats --output test-results/cats
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
+      - name: Browser tests (fight)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: npx playwright test tests/e2e/fight --output test-results/fight
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/fight
+      - name: Browser tests (sound, field guide)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/sound tests/e2e/field-guide
+          --output test-results/sound
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/sound
       - uses: actions/upload-artifact@v4
         if: failure()
         with:
           name: playwright-report
-          path: playwright-report/
+          path: |
+            playwright-report/
+            test-results/
           retention-days: 7
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index a0d5e24..20022e8 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -21,7 +21,7 @@ import { useXenocatCursor } from './fake-cursor';
 import { recordStat } from './field-guide';
 import {
   type CatSounds,
-  createSoundPlayer,
+  sharedSoundPlayer,
   getSoundEnabled,
   setSoundEnabled,
   soundsFor,
@@ -77,7 +77,7 @@ export function XenocatCatsProvider({
     })
   );
   const [cats, setCats] = useState<Cat[]>([]);
-  const [player] = useState(() => createSoundPlayer());
+  const [player] = useState(() => sharedSoundPlayer());
   // Read by the loop and the API, which should not restart when a caller passes a
   // new (equal) list.
   const typesRef = useRef(types);
diff --git a/app/ui/xenocats/fight.tsx b/app/ui/xenocats/fight.tsx
index e8a0464..557ff6b 100644
--- a/app/ui/xenocats/fight.tsx
+++ b/app/ui/xenocats/fight.tsx
@@ -139,6 +139,8 @@ export default function Fight({
   const decoyRefs = useRef<(HTMLDivElement | null)[]>([]);
   const startRef = useRef<HTMLDivElement>(null);
   const dialogRef = useRef<HTMLDivElement>(null);
+  // False once the section has gone: a lock request still pending then gives up.
+  const mountedRef = useRef(true);
   // Cats move every frame, so the loop moves their elements itself; React renders
   // only when what it shows changes (a cat comes or goes, a life, a wave, the hold).
   const shownRef = useRef('');
@@ -205,6 +207,10 @@ export default function Fight({
     startingRef.current = true;
     const locked = await requestLock();
     startingRef.current = false;
+    if (!mountedRef.current) {
+      if (locked) document.exitPointerLock();
+      return;
+    }
     const viewport = viewportSize();
     const at: Vec = cursor.position() ?? { x: viewport.width / 2, y: viewport.height / 2 };
     const common = {
@@ -223,11 +229,18 @@ export default function Fight({
   const resume = async () => {
     const game = gameRef.current;
     if (!game || phaseRef.current !== 'paused') return;
-    if (game.mode === 'locked' && !(await requestLock())) {
-      // Refused this time: carry on with the fake cursor.
-      game.mode = 'fallback';
-      game.pointer = null;
-      setMode('fallback');
+    if (game.mode === 'locked') {
+      const locked = await requestLock();
+      if (!mountedRef.current) {
+        if (locked) document.exitPointerLock();
+        return;
+      }
+      if (!locked) {
+        // Refused this time: carry on with the fake cursor.
+        game.mode = 'fallback';
+        game.pointer = null;
+        setMode('fallback');
+      }
     }
     game.clock.resume(performance.now());
     cursor.hide(game.mode === 'locked');
@@ -350,13 +363,14 @@ export default function Fight({
       if (game.pointer.activeEffectId(game.clock.now(performance.now())) !== null) return;
       if (game.survival.click(game.pointer.position())) setSnap(game.survival.snapshot());
     };
+    let lockLostTimer = 0;
     const onLockChange = () => {
       // The game releasing the lock itself (it is over) is not a loss.
       if (phaseRef.current !== 'playing' || game.mode !== 'locked') return;
       if (document.pointerLockElement === document.body) return;
       // Esc leaves the page focused and visible; a tab or window switch does not.
       // Their blur and visibility events can arrive just after the lock is lost.
-      window.setTimeout(() => {
+      lockLostTimer = window.setTimeout(() => {
         if (document.hasFocus() && document.visibilityState === 'visible') finish();
         else pause();
       }, 100);
@@ -382,6 +396,7 @@ export default function Fight({
     window.addEventListener('resize', onResize);
     return () => {
       cancelAnimationFrame(frameId);
+      window.clearTimeout(lockLostTimer);
       document.removeEventListener('mousemove', onMouseMove);
       document.removeEventListener('mousedown', onMouseDown);
       document.removeEventListener('pointerlockchange', onLockChange);
@@ -393,13 +408,38 @@ export default function Fight({
   }, [running, cursor, cats, finish, pause]);
 
   // Leaving the page mid-game: give the pointer back.
-  useEffect(
-    () => () => {
+  useEffect(() => {
+    mountedRef.current = true;
+    return () => {
+      mountedRef.current = false;
       if (document.pointerLockElement) document.exitPointerLock();
       cursor.hide(false);
-    },
-    [cursor]
-  );
+    };
+  }, [cursor]);
+
+  // The game is a modal dialog: Tab and Shift+Tab stay inside it (on its buttons,
+  // or on the dialog itself when it has none, as under pointer lock).
+  const onDialogKeyDown = (event: React.KeyboardEvent) => {
+    if (event.key !== 'Tab') return;
+    const dialog = dialogRef.current;
+    if (!dialog) return;
+    const buttons = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
+    if (buttons.length === 0) {
+      event.preventDefault();
+      dialog.focus();
+      return;
+    }
+    const first = buttons[0];
+    const last = buttons[buttons.length - 1];
+    const active = document.activeElement;
+    if (event.shiftKey && (active === first || active === dialog)) {
+      event.preventDefault();
+      last.focus();
+    } else if (!event.shiftKey && active === last) {
+      event.preventDefault();
+      first.focus();
+    }
+  };
 
   // Without pointer lock, a click lands where the real pointer is; the fake cursor
   // provider has already swallowed it if an effect is running.
@@ -469,6 +509,7 @@ export default function Fight({
             data-kind={kind}
             data-phase={phase}
             onPointerDown={onOverlayPointerDown}
+            onKeyDown={onDialogKeyDown}
             className="fixed inset-0 z-[9998] select-none bg-void/85 outline-none"
           >
             <div className="flex flex-wrap items-center gap-6 p-4 text-sm font-semibold text-cream">
diff --git a/app/ui/xenocats/sounds.ts b/app/ui/xenocats/sounds.ts
index df5335a..b3865ad 100644
--- a/app/ui/xenocats/sounds.ts
+++ b/app/ui/xenocats/sounds.ts
@@ -191,6 +191,8 @@ export function createSoundPlayer(
     /** The visitor has interacted with the page: audio may start. */
     unlock() {
       unlocked = true;
+      // No context at all while sound is off; one is made when it is switched on.
+      if (!enabled()) return;
       const ctx = ensureContext();
       if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
     },
@@ -257,3 +259,14 @@ function whiteNoise(ctx: AudioContextLike): AudioBuffer {
   for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
   return buffer;
 }
+
+let shared: SoundPlayer | null = null;
+
+/**
+ * The page's one player. Every cats provider uses it, so moving between pages
+ * never leaves an AudioContext behind (browsers cap how many may exist).
+ */
+export function sharedSoundPlayer(): SoundPlayer {
+  shared ??= createSoundPlayer();
+  return shared;
+}
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
index 158cc03..1fe63b1 100644
--- a/tests/e2e/fight.spec.ts
+++ b/tests/e2e/fight.spec.ts
@@ -2,20 +2,23 @@ import { type Page, expect, test } from '@playwright/test';
 import { SURVIVAL_BEST_KEY } from '@/app/ui/xenocats/survival';
 import { TAMED_KEY } from '@/app/ui/xenocats/taming';
 
-// Fight a cat on /cats (no login, no database). These tests take the fallback path:
+// Fight a cat on /cats (no login, no database). Most tests take the fallback path:
 // pointer lock is removed before the page loads, so the game runs with the fake
-// cursor and Playwright's mouse can play it.
+// cursor. The "under pointer lock" tests keep it: headless Chromium grants the lock
+// and reports mouse movement, so the locked path can be played too.
 
-async function openFight(page: Page, best?: number) {
+async function openFight(page: Page, best?: number, { lock = false } = {}) {
   await page.addInitScript(
-    ({ key, best }) => {
-      Object.defineProperty(Element.prototype, 'requestPointerLock', {
-        value: undefined,
-        configurable: true,
-      });
+    ({ key, best, lock }) => {
+      if (!lock) {
+        Object.defineProperty(Element.prototype, 'requestPointerLock', {
+          value: undefined,
+          configurable: true,
+        });
+      }
       if (best !== undefined) window.localStorage.setItem(key, String(best));
     },
-    { key: SURVIVAL_BEST_KEY, best }
+    { key: SURVIVAL_BEST_KEY, best, lock }
   );
   await page.setViewportSize({ width: 1280, height: 800 });
   await page.goto('/cats');
@@ -129,6 +132,16 @@ test('Taming: a pointer moving at the cat makes it dodge', async ({ page }) => {
   await page.mouse.move(100, 100);
   const cat = page.getByTestId('fight-cat');
   await expect(cat).toBeVisible();
+  // A quick dodge (a teleport takes 60 ms) shows in data-doing for a frame or two,
+  // too briefly for polling: record every value the page ever sets instead.
+  await page.evaluate(() => {
+    const seen = new Set<string>();
+    (window as unknown as { doings: Set<string> }).doings = seen;
+    new MutationObserver(() => {
+      const doing = document.querySelector('[data-testid="fight-cat"]')?.getAttribute('data-doing');
+      if (doing) seen.add(doing);
+    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-doing'] });
+  });
   const dodges = ['dash', 'blink', 'sidestep', 'hop', 'circle', 'mirror', 'drop', 'axis'];
   let step = 0;
   await expect
@@ -140,11 +153,14 @@ test('Taming: a pointer moving at the cat makes it dodge', async ({ page }) => {
           const x = box.x + box.width / 2 - 60 + (step++ % 2) * 20;
           await page.mouse.move(x, box.y + box.height / 2);
         }
-        return cat.getAttribute('data-doing');
+        const seen = await page.evaluate(() =>
+          Array.from((window as unknown as { doings: Set<string> }).doings)
+        );
+        return seen.some((doing) => dodges.includes(doing));
       },
       { timeout: 15_000, intervals: [50] }
     )
-    .toMatch(new RegExp(`^(${dodges.join('|')})$`));
+    .toBe(true);
 });
 
 test('Survival: a lower score leaves the best score alone; End game stops it too', async ({
@@ -159,3 +175,134 @@ test('Survival: a lower score leaves the best score alone; End game stops it too
   );
   expect(await page.evaluate((key) => localStorage.getItem(key), SURVIVAL_BEST_KEY)).toBe('7');
 });
+
+test('Survival: losing focus pauses the game, and the cats wait; Resume carries on', async ({
+  page,
+}) => {
+  test.setTimeout(30_000);
+  await openFight(page);
+  const overlay = await start(page);
+  const cat = page.getByTestId('fight-cat').first();
+  await expect(cat).toBeVisible();
+  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
+  await expect(overlay).toHaveAttribute('data-phase', 'paused');
+  const at = await cat.boundingBox();
+  await page.waitForTimeout(600);
+  expect(await cat.boundingBox()).toEqual(at);
+  // The paused game is a modal dialog: Tab cycles through its own buttons only.
+  const resume = overlay.getByRole('button', { name: 'Resume' });
+  const end = overlay.getByRole('button', { name: 'End game' });
+  await resume.focus();
+  await page.keyboard.press('Tab');
+  await expect(end).toBeFocused();
+  await page.keyboard.press('Tab');
+  await expect(resume).toBeFocused();
+  await page.keyboard.press('Shift+Tab');
+  await expect(end).toBeFocused();
+  await overlay.getByRole('button', { name: 'Resume' }).click();
+  await expect(overlay).toHaveAttribute('data-phase', 'playing');
+  await expect.poll(() => cat.boundingBox()).not.toEqual(at);
+});
+
+/** Where the game draws its own pointer under pointer lock. */
+async function lockedPointer(page: Page) {
+  const transform = await page
+    .getByTestId('fight-pointer')
+    .evaluate((el) => (el as HTMLElement).style.transform);
+  const [, x, y] = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(transform)!;
+  return { x: Number(x), y: Number(y) };
+}
+
+test('Survival under pointer lock: the game owns the pointer, a click banishes the cat under it, and losing the lock ends it', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await openFight(page, undefined, { lock: true });
+  const startButton = page.getByTestId('fight-start');
+  const box = (await startButton.boundingBox())!;
+  let mouse = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
+  await page.mouse.move(mouse.x, mouse.y);
+  await startButton.click();
+  const overlay = page.getByTestId('fight-overlay');
+  await expect(overlay).toHaveAttribute('data-mode', /locked|fallback/);
+  // Some headless browsers refuse pointer lock (the game then takes the fallback
+  // path, tested above); there is nothing to test here then.
+  test.skip(
+    (await overlay.getAttribute('data-mode')) !== 'locked',
+    'This browser refused pointer lock.'
+  );
+  expect(await page.evaluate(() => document.pointerLockElement === document.body)).toBe(true);
+  // The page's fake cursor is hidden; the game draws the pointer it owns.
+  await expect(page.getByTestId('fake-cursor')).toHaveCSS('opacity', '0');
+  await expect(page.getByTestId('fight-pointer')).toBeVisible();
+
+  // The game's pointer moves by the mouse's movement.
+  const before = await lockedPointer(page);
+  mouse = { x: mouse.x + 60, y: mouse.y - 40 };
+  await page.mouse.move(mouse.x, mouse.y, { steps: 4 });
+  await expect.poll(() => lockedPointer(page)).toEqual({ x: before.x + 60, y: before.y - 40 });
+
+  // Steer the game's pointer next to a cat and click: that cat is banished.
+  // It is a real-time game: a cat can reach the pointer before the click lands (and
+  // three such cats end the game), so this keeps playing, in a new game if need be,
+  // until one click banishes a cat without losing a life.
+  let banished = false;
+  await expect
+    .poll(
+      async () => {
+        if ((await overlay.count()) === 0) {
+          const again = (await startButton.boundingBox())!;
+          mouse = { x: again.x + again.width / 2, y: again.y + again.height / 2 };
+          await startButton.click();
+          await expect(overlay).toHaveAttribute('data-mode', 'locked');
+        }
+        const cat = page.getByTestId('fight-cat').first();
+        const id = await cat.getAttribute('data-cat-id').catch(() => null);
+        const catBox = await cat.boundingBox().catch(() => null);
+        if (!id || !catBox) return false;
+        const livesNow = () =>
+          page
+            .getByTestId('fight-lives')
+            .getAttribute('data-lives', { timeout: 1000 })
+            .catch(() => null);
+        const lives = await livesNow();
+        const centre = { x: catBox.x + catBox.width / 2, y: catBox.y + catBox.height / 2 };
+        const pointer = await lockedPointer(page);
+        // 34 px from the cat's centre, on the pointer's side: within a click's reach
+        // (36 px), outside an attack's (24 px).
+        const dx = pointer.x - centre.x;
+        const dy = pointer.y - centre.y;
+        const length = Math.hypot(dx, dy) || 1;
+        const target = { x: centre.x + (dx / length) * 34, y: centre.y + (dy / length) * 34 };
+        mouse = { x: mouse.x + target.x - pointer.x, y: mouse.y + target.y - pointer.y };
+        await page.mouse.move(mouse.x, mouse.y);
+        // Let the game draw the pointer there before clicking.
+        await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
+        await page.mouse.down();
+        await page.mouse.up();
+        banished =
+          (await page.locator(`[data-cat-id="${id}"]`).count()) === 0 &&
+          lives !== null &&
+          (await livesNow()) === lives;
+        return banished;
+      },
+      { timeout: 40_000, intervals: [100] }
+    )
+    .toBe(true);
+
+  // Losing the lock ends the game if the page still has focus (that is Esc) and
+  // pauses it if not (another window took it). Some headless browsers never give a
+  // page focus, so the test checks whichever this browser reports.
+  const focused = await page.evaluate(() => document.hasFocus());
+  await page.evaluate(() => document.exitPointerLock());
+  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
+  if (focused) {
+    await expect(page.getByTestId('fight-overlay')).toHaveCount(0);
+    await expect(page.getByRole('status').filter({ hasText: 'Game over' })).toContainText(
+      'Game over. You survived'
+    );
+  } else {
+    await expect(overlay).toHaveAttribute('data-phase', 'paused');
+    await expect(overlay.getByRole('button', { name: 'Resume' })).toBeVisible();
+  }
+});
diff --git a/tests/unit/xenocats/sounds.test.ts b/tests/unit/xenocats/sounds.test.ts
index da93550..d311cf2 100644
--- a/tests/unit/xenocats/sounds.test.ts
+++ b/tests/unit/xenocats/sounds.test.ts
@@ -8,6 +8,7 @@ import {
   createSoundPlayer,
   getSoundEnabled,
   setSoundEnabled,
+  sharedSoundPlayer,
   soundsFor,
 } from '@/app/ui/xenocats/sounds';
 
@@ -119,6 +120,21 @@ describe('the player', () => {
     expect(ctx.resume).toHaveBeenCalledTimes(2);
   });
 
+  it('makes no audio context at all while sound is switched off', () => {
+    const make = vi.fn(fakeContext);
+    let on = false;
+    const player = createSoundPlayer(make as never, () => on);
+    player.unlock();
+    expect(make).not.toHaveBeenCalled();
+    on = true;
+    player.unlock();
+    expect(make).toHaveBeenCalledTimes(1);
+  });
+
+  it('is one player for the whole page, however many providers mount', () => {
+    expect(sharedSoundPlayer()).toBe(sharedSoundPlayer());
+  });
+
   it('plays nothing while sound is switched off', () => {
     const ctx = fakeContext();
     const player = createSoundPlayer(
~~~~

</details>

#### T6 — `night-2026-10-01-t6-pet-cat`

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

<details><summary>Code:  10 files changed, 493 insertions(+), 23 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index dcbefa3..5113930 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -47,7 +47,7 @@ jobs:
         run: >-
           npx vitest run tests/unit/xenocats/survival tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
-          tests/unit/xenocats/field-guide
+          tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat
       # A test file in no group would never run: each unit test must be named in a
       # group above, each browser test in a group of both browser jobs below.
       - name: Every test file is in a group
@@ -112,9 +112,9 @@ jobs:
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
-      - name: Browser tests against next start (cats)
+      - name: Browser tests against next start (cats, petting)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
-        run: npx playwright test tests/e2e/cats --output test-results/cats
+        run: npx playwright test tests/e2e/cats tests/e2e/pet-cat --output test-results/cats
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
@@ -178,9 +178,9 @@ jobs:
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
-      - name: Browser tests (cats)
+      - name: Browser tests (cats, petting)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
-        run: npx playwright test tests/e2e/cats --output test-results/cats
+        run: npx playwright test tests/e2e/cats tests/e2e/pet-cat --output test-results/cats
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
       - name: Browser tests (fight)
diff --git a/app/ui/global.css b/app/ui/global.css
index 1452bc8..57c8e54 100644
--- a/app/ui/global.css
+++ b/app/ui/global.css
@@ -1178,3 +1178,8 @@ input[type='number']::-webkit-outer-spin-button {
   -webkit-text-fill-color: currentcolor;
   pointer-events: none;
 }
+
+/* A cat clicked awake glows red until it has attacked and gone. */
+.xenocat-angry {
+  filter: drop-shadow(0 0 6px #ef4444) drop-shadow(0 0 2px #ef4444);
+}
diff --git a/app/ui/xenocats/cat-engine.ts b/app/ui/xenocats/cat-engine.ts
index f8a3827..0298a9b 100644
--- a/app/ui/xenocats/cat-engine.ts
+++ b/app/ui/xenocats/cat-engine.ts
@@ -6,6 +6,10 @@
 // `ready` is where a cat waits while another cat's effect is still running: only
 // one effect runs at a time, so its attack is retried every tick until accepted.
 // A summoned cat skips sleeping and waking, unless it is summoned asleep.
+//
+// A sleeping cat with the pointer resting on it for `petMs` is petted: it purrs and
+// sleeps on for at least `petSleepMs`. A sleeping cat clicked (`poke`) wakes at once,
+// angry: its attack is `angryFactor` times stronger (effects.ts `strengthen`).
 
 import type { CatType } from './cat-types';
 import { CAT_CONFIG, type CatConfig, type Range } from './config';
@@ -26,6 +30,12 @@ export type Cat = {
   phaseEndsAt: number;
   /** Summoned cats attack as soon as they have arrived. */
   eager: boolean;
+  /** Clicked awake: its attack is stronger. */
+  angry: boolean;
+  /** Has purred at least once. */
+  petted: boolean;
+  /** Since when the pointer has rested on it while it sleeps, or null. */
+  petSince: number | null;
 };
 
 /** Called when a cat is ready to pounce; false while another effect still runs. */
@@ -56,6 +66,13 @@ export function createCatEngine(options: {
     y: cat.y + config.catSize / 2,
   });
 
+  /** True if `point` is on the cat's square. */
+  const covers = (cat: Cat, point: Vec) =>
+    point.x >= cat.x &&
+    point.x <= cat.x + config.catSize &&
+    point.y >= cat.y &&
+    point.y <= cat.y + config.catSize;
+
   function setPhase(cat: Cat, phase: CatPhase, at: number, lasts: number) {
     cat.phase = phase;
     cat.phaseStartedAt = at;
@@ -96,6 +113,9 @@ export function createCatEngine(options: {
       phaseStartedAt: now,
       phaseEndsAt: now + type.entranceMs,
       eager,
+      angry: false,
+      petted: false,
+      petSince: null,
     };
     cats.push(cat);
     return cat;
@@ -130,10 +150,46 @@ export function createCatEngine(options: {
       return type ? spawn(type, now, cursor, !asleep) : null;
     },
 
-    /** Advances every cat to `now`. Returns true if anything a renderer shows changed. */
-    tick(now: number, cursor: Vec | null, tryAttack: TryAttack): boolean {
+    /**
+     * A click at `point`: a sleeping cat under it wakes at once, angry. Returns
+     * that cat, or null if the click hit no sleeping cat.
+     */
+    poke(point: Vec, now: number): Cat | null {
+      const cat = cats.find((c) => c.phase === 'sleeping' && covers(c, point));
+      if (!cat) return null;
+      cat.angry = true;
+      cat.petSince = null;
+      setPhase(cat, 'waking', now, config.wakeMs);
+      return cat;
+    },
+
+    /**
+     * Advances every cat to `now`. Returns true if anything a renderer shows
+     * changed. `onPurr` is called for each cat petted this tick.
+     */
+    tick(
+      now: number,
+      cursor: Vec | null,
+      tryAttack: TryAttack,
+      onPurr: (cat: Cat) => void = () => {}
+    ): boolean {
       let changed = false;
 
+      for (const cat of cats) {
+        if (cat.phase !== 'sleeping' || !cursor || !covers(cat, cursor)) {
+          cat.petSince = null;
+          continue;
+        }
+        cat.petSince ??= now;
+        if (now - cat.petSince >= config.petMs) {
+          cat.petSince = now;
+          cat.phaseEndsAt = Math.max(cat.phaseEndsAt, now + config.petSleepMs);
+          if (!cat.petted) changed = true;
+          cat.petted = true;
+          onPurr(cat);
+        }
+      }
+
       if (autoSpawn) {
         nextSpawnAt ??= now + between(config.firstSpawnMs);
         if (now >= nextSpawnAt) {
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index 20022e8..5a6308a 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -17,6 +17,7 @@ import { catArt } from './cat-art';
 import { CatSprite } from './cat-sprite';
 import { CAT_TYPES, type CatType } from './cat-types';
 import type { CatConfig } from './config';
+import { strengthen } from './effects';
 import { useXenocatCursor } from './fake-cursor';
 import { recordStat } from './field-guide';
 import {
@@ -107,6 +108,20 @@ export function XenocatCatsProvider({
     ] as const;
     for (const type of gestures) window.addEventListener(type, unlock, { capture: true });
 
+    // Clicking a sleeping cat wakes it at once, angry. The click itself goes on to
+    // whatever is under the cat, as always (the cats never take clicks).
+    // A mouse click lands where the visible cursor is; a tap or a pen, where it
+    // touched. Not while an effect blocks clicks.
+    const onPoke = (event: PointerEvent) => {
+      if (cursor.isBusy()) return;
+      const touched = { x: event.clientX, y: event.clientY };
+      const at = event.pointerType === 'mouse' ? (cursor.position() ?? touched) : touched;
+      if (engine.poke(at, cursor.now())) {
+        setCats(snapshot(engine));
+      }
+    };
+    window.addEventListener('pointerdown', onPoke, { capture: true });
+
     // A cat's sounds follow its phases: arriving, then waking up.
     const phases = new Map<number, CatPhase>();
     const playPhases = () => {
@@ -128,20 +143,35 @@ export function XenocatCatsProvider({
 
     const tick = () => {
       playPhases();
-      const changed = engine.tick(cursor.now(), cursor.position(), (_cat, type, centre) => {
-        // No cursor at all (a touch screen, or the pointer not seen yet): the cat
-        // pounces at nothing and leaves, rather than waiting on screen for ever.
-        if (cursor.position() === null) return true;
-        // The pointer is off the page: wait, rather than block clicks with an effect
-        // nobody sees.
-        if (!cursor.isPresent()) return false;
-        // The page is drawing its own pointer (a locked Fight game): wait until it is done.
-        if (cursor.isHidden()) return false;
-        if (!cursor.attack(type.effect, centre)) return false;
-        player.play(soundsFor(type).attack);
-        recordStat(type.id, 'survived');
-        return true;
-      });
+      const purr = (cat: Cat) => {
+        const type = typesRef.current.find((t) => t.id === cat.typeId);
+        if (type) player.play(soundsFor(type).purr);
+      };
+      // Petting needs the pointer on the page: one that has left it pets nothing.
+      const pointer = cursor.isPresent() ? cursor.position() : null;
+      const changed = engine.tick(
+        cursor.now(),
+        pointer,
+        (cat, type, centre) => {
+          // No cursor at all (a touch screen, or the pointer not seen yet): the cat
+          // pounces at nothing and leaves, rather than waiting on screen for ever.
+          if (cursor.position() === null) return true;
+          // The pointer is off the page: wait, rather than block clicks with an effect
+          // nobody sees.
+          if (!cursor.isPresent()) return false;
+          // The page is drawing its own pointer (a locked Fight game): wait until it is done.
+          if (cursor.isHidden()) return false;
+          // A cat clicked awake attacks angrily: harder and for longer.
+          const effect = cat.angry
+            ? strengthen(type.effect, engine.config.angryFactor)
+            : type.effect;
+          if (!cursor.attack(effect, centre)) return false;
+          player.play(soundsFor(type).attack);
+          recordStat(type.id, 'survived');
+          return true;
+        },
+        purr
+      );
       if (changed) setCats(snapshot(engine));
       frameId = requestAnimationFrame(tick);
     };
@@ -151,6 +181,7 @@ export function XenocatCatsProvider({
       cancelAnimationFrame(frameId);
       window.removeEventListener('resize', onResize);
       for (const type of gestures) window.removeEventListener(type, unlock, { capture: true });
+      window.removeEventListener('pointerdown', onPoke, { capture: true });
     };
   }, [engine, cursor, player]);
 
@@ -265,7 +296,9 @@ function CatView({
       data-testid="xenocat"
       data-cat-type={type.id}
       data-phase={cat.phase}
-      className={`absolute ${outer?.className ?? ''}`}
+      data-angry={cat.angry || undefined}
+      data-petted={cat.petted || undefined}
+      className={`absolute ${outer?.className ?? ''} ${cat.angry ? 'xenocat-angry' : ''}`}
       style={style}
     >
       <div
diff --git a/app/ui/xenocats/config.ts b/app/ui/xenocats/config.ts
index cf4f564..a551141 100644
--- a/app/ui/xenocats/config.ts
+++ b/app/ui/xenocats/config.ts
@@ -25,6 +25,12 @@ export type CatConfig = {
   pageHitRadius: number;
   /** At most this many page elements per attack. */
   maxPageTargets: number;
+  /** Resting the pointer on a sleeping cat this long pets it: it purrs. */
+  petMs: number;
+  /** A petted cat sleeps on at least this long after the last purr. */
+  petSleepMs: number;
+  /** A cat clicked awake is angry: its attack is this many times stronger. */
+  angryFactor: number;
 };
 
 export const CAT_CONFIG: CatConfig = {
@@ -39,4 +45,7 @@ export const CAT_CONFIG: CatConfig = {
   attackMs: 600,
   pageHitRadius: 120,
   maxPageTargets: 6,
+  petMs: 1000,
+  petSleepMs: 4000,
+  angryFactor: 1.5,
 };
diff --git a/app/ui/xenocats/effects.ts b/app/ui/xenocats/effects.ts
index 712f6bc..8e158ab 100644
--- a/app/ui/xenocats/effects.ts
+++ b/app/ui/xenocats/effects.ts
@@ -68,6 +68,12 @@ export type Effect<S = unknown> = {
   description: string;
   /** At most MAX_EFFECT_MS. */
   durationMs: number;
+  /**
+   * 'offset' for an effect that draws the cursor at an offset from the real
+   * pointer: made stronger, the offset grows. Others place it elsewhere (a fixed
+   * point, the cat, their own path), and are only made longer (`strengthen`).
+   */
+  amplify?: 'offset';
   step(input: EffectInput<S>): EffectFrame<S>;
 };
 
@@ -128,6 +134,7 @@ export const KNOCKBACK_FLIGHT_MS = 250;
 
 export const knockback: Effect = {
   id: 'knockback',
+  amplify: 'offset',
   name: 'Knockback',
   description: 'Your cursor is flung 300 px away from the cat.',
   durationMs: 1500,
@@ -159,6 +166,7 @@ export const JITTER_STEP_MS = 40;
 
 export const jitter: Effect = {
   id: 'jitter',
+  amplify: 'offset',
   name: 'Jitter',
   description: 'Your cursor shakes for 4 seconds.',
   durationMs: 4000,
@@ -191,6 +199,7 @@ export const DRIFT_PX_PER_S = 110;
 
 export const drift: Effect = {
   id: 'drift',
+  amplify: 'offset',
   name: 'Drift',
   description: 'Your cursor is pushed steadily in one direction for 5 seconds.',
   durationMs: 5000,
@@ -221,6 +230,7 @@ type TeleportState = { jump: number; anchor: Vec; spot: Vec };
 
 export const teleport: Effect<TeleportState> = {
   id: 'teleport',
+  amplify: 'offset',
   name: 'Teleport',
   description: 'Your cursor jumps to a random spot, three times.',
   durationMs: TELEPORT_JUMPS * TELEPORT_EVERY_MS,
@@ -304,6 +314,7 @@ export const DECOY_RING: readonly [number, number] = [80, 160];
 
 export const decoys: Effect = {
   id: 'decoys',
+  amplify: 'offset',
   name: 'Decoys',
   description: 'Four identical cursors for 5 seconds. Which one is yours?',
   durationMs: 5000,
@@ -347,6 +358,7 @@ export const DRUNK_AMPLITUDE = 40;
 
 export const drunk: Effect = {
   id: 'drunk',
+  amplify: 'offset',
   name: 'Drunk',
   description: 'Your cursor wobbles about for 5 seconds.',
   durationMs: 5000,
@@ -421,6 +433,7 @@ export const FALL_PX_PER_S = 260;
 
 export const fall: Effect = {
   id: 'fall',
+  amplify: 'offset',
   name: 'Fall',
   description: 'Your cursor sinks towards the bottom unless you keep moving up, for 4 seconds.',
   durationMs: 4000,
@@ -524,3 +537,54 @@ export const axisLock: Effect = {
     };
   },
 };
+
+/** What a strengthened effect carries between frames: the effect's own state and look. */
+type Strengthened<S> = { inner: S | undefined; look: CursorLook | null };
+
+/**
+ * The same effect, `factor` times stronger: it lasts that much longer (within
+ * MAX_EFFECT_MS), blurs and grows or shrinks the cursor that much more, and, for an
+ * effect that draws the cursor at an offset from the real pointer (`amplify:
+ * 'offset'`), moves it that much further (decoys too). An effect that places the
+ * cursor elsewhere keeps its path: freeze stays frozen, orbit circles the cat. The
+ * effect itself still sees its own, unstrengthened previous look, so one that
+ * builds on it does not compound. An angry cat attacks with this (cat-engine.ts).
+ */
+export function strengthen<S>(effect: Effect<S>, factor: number): Effect<Strengthened<S>> {
+  return {
+    id: effect.id,
+    name: effect.name,
+    description: effect.description,
+    amplify: effect.amplify,
+    durationMs: Math.min(Math.round(effect.durationMs * factor), MAX_EFFECT_MS),
+    step(input) {
+      const own = input.state;
+      const frame = effect.step({
+        ...input,
+        previous: own?.look ?? input.previous,
+        state: own?.inner,
+      });
+      const { look } = frame;
+      const away = (point: Vec): Vec =>
+        effect.amplify !== 'offset'
+          ? point
+          : clampToViewport(
+              {
+                x: input.real.x + (point.x - input.real.x) * factor,
+                y: input.real.y + (point.y - input.real.y) * factor,
+              },
+              input.viewport
+            );
+      return {
+        look: {
+          ...look,
+          ...away(look),
+          blur: look.blur * factor,
+          scale: look.scale ** factor,
+          ...(look.decoys ? { decoys: look.decoys.map(away) } : {}),
+        },
+        state: { inner: frame.state, look },
+      };
+    },
+  };
+}
diff --git a/app/ui/xenocats/sounds.ts b/app/ui/xenocats/sounds.ts
index b3865ad..897a1af 100644
--- a/app/ui/xenocats/sounds.ts
+++ b/app/ui/xenocats/sounds.ts
@@ -91,7 +91,7 @@ const transpose = (sound: Sound, factor: number): Sound =>
     ...(t.endFreq ? { endFreq: t.endFreq * factor } : {}),
   }));
 
-export type CatSounds = { attack: Sound; wake: Sound; arrive: Sound };
+export type CatSounds = { attack: Sound; wake: Sound; arrive: Sound; purr: Sound };
 
 /** A cat type's three sounds. */
 export function soundsFor(type: CatType): CatSounds {
@@ -105,6 +105,11 @@ export function soundsFor(type: CatType): CatSounds {
     ),
     // A soft rising pop.
     arrive: transpose([tone('sine', 196, 0, 0.25, 0.35, 392)], pitch),
+    // A low, rolling purr: quick soft pulses.
+    purr: transpose(
+      [0, 0.09, 0.18, 0.27, 0.36, 0.45].map((at) => tone('sawtooth', 55, at, 0.07, 0.25)),
+      pitch
+    ),
   };
 }
 
diff --git a/tests/e2e/pet-cat.spec.ts b/tests/e2e/pet-cat.spec.ts
new file mode 100644
index 0000000..0be7ecd
--- /dev/null
+++ b/tests/e2e/pet-cat.spec.ts
@@ -0,0 +1,94 @@
+import { type Page, expect, test } from '@playwright/test';
+import { CAT_CONFIG } from '@/app/ui/xenocats/config';
+import { vanish } from '@/app/ui/xenocats/effects';
+
+// Petting and poking a sleeping cat on /cats (no login, no database). Web Audio is
+// replaced by a stand-in that counts the tones it is asked to play.
+
+async function openCats(page: Page) {
+  await page.addInitScript(() => {
+    const w = window as unknown as { tones: number; AudioContext: unknown };
+    w.tones = 0;
+    const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
+    const node = { connect() {}, start() {}, stop() {} };
+    w.AudioContext = class {
+      currentTime = 0;
+      sampleRate = 8000;
+      state = 'running';
+      destination = {};
+      resume() {
+        return Promise.resolve();
+      }
+      createGain() {
+        return { ...node, gain: param };
+      }
+      createOscillator() {
+        w.tones++;
+        return { ...node, type: 'sine', frequency: param };
+      }
+      createBuffer(_c: number, n: number) {
+        return { getChannelData: () => new Float32Array(n) };
+      }
+      createBufferSource() {
+        w.tones++;
+        return { ...node, buffer: null };
+      }
+    };
+  });
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
+  let nudge = 0;
+  await expect
+    .poll(async () => {
+      await page.mouse.move(640 + (nudge++ % 2), 400);
+      return page.locator('html').getAttribute('class');
+    })
+    .toContain('xenocat-cursor-hidden');
+}
+
+const tones = (page: Page) => page.evaluate(() => (window as unknown as { tones: number }).tones);
+
+/** Summons Void Tabby asleep and puts the pointer on it. Returns the cat. */
+async function sleepingCatUnderPointer(page: Page) {
+  await page.getByTestId('summon-asleep-void-tabby').click();
+  const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]');
+  await expect(cat).toHaveAttribute('data-phase', 'sleeping');
+  const box = (await cat.boundingBox())!;
+  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
+  return { cat, centre: { x: box.x + box.width / 2, y: box.y + box.height / 2 } };
+}
+
+test('resting the pointer on a sleeping cat pets it: it purrs and sleeps on', async ({ page }) => {
+  test.setTimeout(60_000);
+  await openCats(page);
+  const { cat } = await sleepingCatUnderPointer(page);
+  const before = await tones(page);
+  await expect(cat).toHaveAttribute('data-petted', 'true', { timeout: CAT_CONFIG.petMs + 2000 });
+  await expect.poll(() => tones(page)).toBeGreaterThan(before);
+  // A cat sleeps 8–22 s; petted, it is still asleep after that.
+  await page.waitForTimeout(CAT_CONFIG.sleepMs[1] + 1000);
+  await expect(cat).toHaveAttribute('data-phase', 'sleeping');
+});
+
+test('clicking a sleeping cat wakes it at once, angry, and its attack lasts longer', async ({
+  page,
+}) => {
+  test.setTimeout(30_000);
+  await openCats(page);
+  const { cat, centre } = await sleepingCatUnderPointer(page);
+  await page.mouse.click(centre.x, centre.y);
+  await expect(cat).toHaveAttribute('data-angry', 'true');
+  await expect(cat).not.toHaveAttribute('data-phase', 'sleeping');
+  // Void Tabby's vanish lasts 3 s; angry, 1.5 times that.
+  const fake = page.getByTestId('fake-cursor');
+  await expect(fake).toHaveAttribute('data-effect', 'vanish', { timeout: 5000 });
+  // At least 3.4 s after it began (it began before it was seen), it is still on.
+  await page.waitForTimeout(vanish.durationMs + 400);
+  await expect(fake).toHaveAttribute('data-effect', 'vanish');
+  // …and ends within 4.5 s. (The click also reached whatever was under the cat,
+  // which may have summoned another cat whose attack follows.)
+  await expect(fake).not.toHaveAttribute('data-effect', 'vanish', {
+    timeout: vanish.durationMs * CAT_CONFIG.angryFactor,
+  });
+});
diff --git a/tests/unit/xenocats/pet-cat.test.ts b/tests/unit/xenocats/pet-cat.test.ts
new file mode 100644
index 0000000..7fb5b47
--- /dev/null
+++ b/tests/unit/xenocats/pet-cat.test.ts
@@ -0,0 +1,203 @@
+import { describe, expect, it, vi } from 'vitest';
+import { type Cat, type TryAttack, createCatEngine } from '@/app/ui/xenocats/cat-engine';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { CAT_CONFIG } from '@/app/ui/xenocats/config';
+import {
+  type CursorLook,
+  type Effect,
+  MAX_EFFECT_MS,
+  fall,
+  freeze,
+  heavy,
+  knockback,
+  orbit,
+  restingLook,
+  strengthen,
+} from '@/app/ui/xenocats/effects';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+const viewport = { width: 1200, height: 800 };
+const never: TryAttack = () => false;
+const { petMs, petSleepMs, angryFactor, catSize } = CAT_CONFIG;
+
+/** One cat summoned asleep, its first tick done: it is asleep at `sleepsFrom`. */
+function sleepingCat() {
+  const engine = createCatEngine({
+    random: createRandom(4),
+    types: CAT_TYPES,
+    viewport,
+    autoSpawn: false,
+  });
+  const cat = engine.summon('void-tabby', 0, null, { asleep: true })!;
+  const entrance = CAT_TYPES.find((t) => t.id === 'void-tabby')!.entranceMs;
+  engine.tick(entrance, null, never);
+  expect(cat.phase).toBe('sleeping');
+  const on = { x: cat.x + catSize / 2, y: cat.y + catSize / 2 };
+  return { engine, cat, on, sleepsFrom: entrance, wakesAt: cat.phaseEndsAt };
+}
+
+describe('petting a sleeping cat', () => {
+  it('a pointer resting on it for a second makes it purr', () => {
+    const { engine, cat, on, sleepsFrom } = sleepingCat();
+    const purr = vi.fn();
+    engine.tick(sleepsFrom + 10, on, never, purr);
+    engine.tick(sleepsFrom + 10 + petMs - 20, on, never, purr);
+    expect(purr).not.toHaveBeenCalled();
+    engine.tick(sleepsFrom + 10 + petMs, on, never, purr);
+    expect(purr).toHaveBeenCalledTimes(1);
+    expect(purr.mock.calls[0][0]).toBe(cat);
+    expect(cat.petted).toBe(true);
+  });
+
+  it('delays its waking: it sleeps on while petted, and a while after', () => {
+    const { engine, cat, on, sleepsFrom, wakesAt } = sleepingCat();
+    // Pet it right up to (and well past) when it would have woken.
+    let now = sleepsFrom;
+    for (; now <= wakesAt + 3000; now += 50) engine.tick(now, on, never);
+    expect(cat.phase).toBe('sleeping');
+    // The pointer leaves: it still sleeps for petSleepMs after the last purr.
+    const away = { x: 0, y: 0 };
+    engine.tick(now, away, never);
+    expect(cat.phase).toBe('sleeping');
+    for (const end = now + petSleepMs + 100; now <= end; now += 50) engine.tick(now, away, never);
+    expect(cat.phase).not.toBe('sleeping');
+  });
+
+  it('moving off the cat starts the second over', () => {
+    const { engine, on, sleepsFrom } = sleepingCat();
+    const purr = vi.fn();
+    engine.tick(sleepsFrom + 10, on, never, purr);
+    engine.tick(sleepsFrom + 600, { x: 0, y: 0 }, never, purr);
+    engine.tick(sleepsFrom + 700, on, never, purr);
+    engine.tick(sleepsFrom + 1500, on, never, purr);
+    expect(purr).not.toHaveBeenCalled();
+  });
+
+  it('a pointer that has left the page pets nothing', () => {
+    const { engine, sleepsFrom } = sleepingCat();
+    const purr = vi.fn();
+    for (let now = sleepsFrom; now < sleepsFrom + 3000; now += 50) {
+      engine.tick(now, null, never, purr);
+    }
+    expect(purr).not.toHaveBeenCalled();
+  });
+
+  it('only sleeping cats are petted', () => {
+    const engine = createCatEngine({
+      random: createRandom(4),
+      types: CAT_TYPES,
+      viewport,
+      autoSpawn: false,
+    });
+    const cat = engine.summon('void-tabby', 0, null)!;
+    const on = { x: cat.x + 5, y: cat.y + 5 };
+    const purr = vi.fn();
+    for (let now = 0; now < 3000; now += 50) engine.tick(now, on, never, purr);
+    expect(purr).not.toHaveBeenCalled();
+  });
+});
+
+describe('clicking a sleeping cat', () => {
+  it('wakes it at once, angry', () => {
+    const { engine, cat, on, sleepsFrom } = sleepingCat();
+    expect(engine.poke(on, sleepsFrom + 100)).toBe(cat);
+    expect(cat.phase).toBe('waking');
+    expect(cat.angry).toBe(true);
+    expect(cat.phaseEndsAt).toBe(sleepsFrom + 100 + CAT_CONFIG.wakeMs);
+  });
+
+  it('a click beside it, or on an awake cat, does nothing', () => {
+    const { engine, cat, sleepsFrom } = sleepingCat();
+    expect(engine.poke({ x: cat.x - 5, y: cat.y - 5 }, sleepsFrom + 100)).toBeNull();
+    expect(cat.phase).toBe('sleeping');
+    const awake = engine.summon('gravi-coon', sleepsFrom, null)!;
+    expect(engine.poke({ x: awake.x + 5, y: awake.y + 5 }, sleepsFrom + 100)).toBeNull();
+    expect(awake.angry).toBe(false);
+  });
+
+  it('the angry cat attacks with its effect made stronger', () => {
+    const { engine, on, sleepsFrom } = sleepingCat();
+    engine.poke(on, sleepsFrom);
+    const seen: Cat[] = [];
+    const attack: TryAttack = (cat) => {
+      seen.push({ ...cat });
+      return true;
+    };
+    for (let now = sleepsFrom; now < sleepsFrom + 3000; now += 50) engine.tick(now, null, attack);
+    expect(seen).toHaveLength(1);
+    expect(seen[0].angry).toBe(true);
+  });
+});
+
+/**
+ * Runs `effect` for `ms`, the real pointer starting at `from` and moving by `move`
+ * each frame, as a real pointer does; returns the looks.
+ */
+function run<S>(effect: Effect<S>, ms: number, from = { x: 600, y: 400 }, move = { x: 0, y: 0 }) {
+  const looks: CursorLook[] = [];
+  let real = from;
+  let previous = restingLook(real);
+  let state: S | undefined;
+  for (let elapsed = 0; elapsed <= ms; elapsed += 16) {
+    real = { x: real.x + move.x, y: real.y + move.y };
+    const frame = effect.step({
+      real,
+      delta: move,
+      previous,
+      start: { x: 600, y: 400 },
+      cat: { x: 500, y: 400 },
+      elapsed,
+      dt: 16,
+      viewport,
+      roll: 0.3,
+      state,
+    });
+    state = frame.state;
+    previous = frame.look;
+    looks.push(frame.look);
+  }
+  return looks;
+}
+
+describe('a stronger effect', () => {
+  it('lasts longer, never past the limit', () => {
+    expect(strengthen(knockback, angryFactor).durationMs).toBe(
+      Math.round(knockback.durationMs * angryFactor)
+    );
+    expect(strengthen(knockback, 100).durationMs).toBe(MAX_EFFECT_MS);
+    expect(strengthen(knockback, angryFactor).id).toBe(knockback.id);
+  });
+
+  it('throws the cursor further', () => {
+    const plain = run(knockback, 400).at(-1)!;
+    const strong = run(strengthen(knockback, angryFactor), 400).at(-1)!;
+    expect(strong.x - 600).toBeCloseTo((plain.x - 600) * angryFactor, 5);
+  });
+
+  it('does not compound an effect that builds on its previous look', () => {
+    // Fall drops the cursor from where it was each frame: the stronger one ends
+    // exactly 1.5 times as far below the pointer, not more each frame.
+    const step = { x: 2, y: 0 };
+    const from = { x: 600, y: 200 };
+    const plain = run(fall, 1000, from, step);
+    const strong = run(strengthen(fall, angryFactor), 1000, from, step);
+    const below = (looks: CursorLook[]) => looks.at(-1)!.y - from.y;
+    expect(below(plain)).toBeGreaterThan(50);
+    expect(below(strong)).toBeCloseTo(below(plain) * angryFactor, 5);
+  });
+
+  it('keeps an effect that places the cursor elsewhere on its own path', () => {
+    // Freeze holds the cursor where the attack began, however the mouse moves.
+    const step = { x: 5, y: 3 };
+    for (const look of run(strengthen(freeze, angryFactor), 1000, { x: 600, y: 400 }, step)) {
+      expect({ x: look.x, y: look.y }).toEqual({ x: 600, y: 400 });
+    }
+    // Heavy (30% speed) keeps its speed; it only lasts longer.
+    const plain = run(heavy, 500, { x: 600, y: 400 }, step);
+    const strong = run(strengthen(heavy, angryFactor), 500, { x: 600, y: 400 }, step);
+    expect(strong.map((l) => [l.x, l.y])).toEqual(plain.map((l) => [l.x, l.y]));
+    expect(strengthen(orbit, angryFactor).durationMs).toBe(
+      Math.round(orbit.durationMs * angryFactor)
+    );
+  });
+});
diff --git a/tests/unit/xenocats/sounds.test.ts b/tests/unit/xenocats/sounds.test.ts
index d311cf2..8b187ce 100644
--- a/tests/unit/xenocats/sounds.test.ts
+++ b/tests/unit/xenocats/sounds.test.ts
@@ -35,6 +35,7 @@ describe('every cat type has its sounds', () => {
       valid(sounds.attack);
       valid(sounds.wake);
       valid(sounds.arrive);
+      valid(sounds.purr);
       expect(ATTACK_SOUNDS[type.effect.id], type.id).toBe(sounds.attack);
     }
   });
~~~~

</details>

#### T7 — `night-2026-10-01-t7-combos`

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

<details><summary>Code:  9 files changed, 550 insertions(+), 20 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 5113930..08afca7 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -47,7 +47,7 @@ jobs:
         run: >-
           npx vitest run tests/unit/xenocats/survival tests/unit/xenocats/locked-pointer
           tests/unit/xenocats/taming tests/unit/xenocats/page-hits tests/unit/xenocats/sounds
-          tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat
+          tests/unit/xenocats/field-guide tests/unit/xenocats/pet-cat tests/unit/xenocats/combos
       # A test file in no group would never run: each unit test must be named in a
       # group above, each browser test in a group of both browser jobs below.
       - name: Every test file is in a group
diff --git a/app/ui/xenocats/cat-engine.ts b/app/ui/xenocats/cat-engine.ts
index 0298a9b..48219a5 100644
--- a/app/ui/xenocats/cat-engine.ts
+++ b/app/ui/xenocats/cat-engine.ts
@@ -10,8 +10,13 @@
 // A sleeping cat with the pointer resting on it for `petMs` is petted: it purrs and
 // sleeps on for at least `petSleepMs`. A sleeping cat clicked (`poke`) wakes at once,
 // angry: its attack is `angryFactor` times stronger (effects.ts `strengthen`).
+//
+// Two cats that start waking within `comboWindowMs` and `comboDistance` of each
+// other, whose attacks have a combo (combos.ts), are paired: they attack once,
+// together, with the combined effect. Only one combo at a time.
 
 import type { CatType } from './cat-types';
+import { type Combo, findCombo } from './combos';
 import { CAT_CONFIG, type CatConfig, type Range } from './config';
 import type { Size, Vec } from './effects';
 import type { Random } from './random';
@@ -36,10 +41,19 @@ export type Cat = {
   petted: boolean;
   /** Since when the pointer has rested on it while it sleeps, or null. */
   petSince: number | null;
+  /** When it began to wake, or null if it has not (or was summoned awake). */
+  wokeAt: number | null;
+  /** The cat it attacks together with, in a combo, or null. */
+  comboWith: number | null;
+  /** The combo's effect id, while paired. */
+  combo: string | null;
 };
 
-/** Called when a cat is ready to pounce; false while another effect still runs. */
-export type TryAttack = (cat: Cat, type: CatType, centre: Vec) => boolean;
+/**
+ * Called when a cat is ready to pounce; false while another effect still runs. For
+ * a combo, `centre` is between the two cats and `combo` is set; `cat` is either one.
+ */
+export type TryAttack = (cat: Cat, type: CatType, centre: Vec, combo?: Combo) => boolean;
 
 export type CatEngine = ReturnType<typeof createCatEngine>;
 
@@ -73,6 +87,35 @@ export function createCatEngine(options: {
     point.y >= cat.y &&
     point.y <= cat.y + config.catSize;
 
+  const distanceBetween = (a: Cat, b: Cat) => {
+    const ca = centreOf(a);
+    const cb = centreOf(b);
+    return Math.hypot(ca.x - cb.x, ca.y - cb.y);
+  };
+
+  /** The cat starts to wake at `at`, and pairs up for a combo if it can. */
+  function startWaking(cat: Cat, at: number) {
+    setPhase(cat, 'waking', at, config.wakeMs);
+    cat.wokeAt = at;
+    // One combo at a time: none while another pair is still to attack or attacking.
+    if (cats.some((c) => c.comboWith !== null)) return;
+    const effect = typeOf(cat).effect.id;
+    const partner = cats.find(
+      (other) =>
+        other !== cat &&
+        (other.phase === 'waking' || other.phase === 'ready') &&
+        other.wokeAt !== null &&
+        Math.abs(at - other.wokeAt) <= config.comboWindowMs &&
+        distanceBetween(cat, other) <= config.comboDistance &&
+        findCombo(effect, typeOf(other).effect.id) !== undefined
+    );
+    if (!partner) return;
+    const combo = findCombo(effect, typeOf(partner).effect.id)!;
+    cat.comboWith = partner.id;
+    partner.comboWith = cat.id;
+    cat.combo = partner.combo = combo.effect.id;
+  }
+
   function setPhase(cat: Cat, phase: CatPhase, at: number, lasts: number) {
     cat.phase = phase;
     cat.phaseStartedAt = at;
@@ -116,6 +159,9 @@ export function createCatEngine(options: {
       angry: false,
       petted: false,
       petSince: null,
+      wokeAt: null,
+      comboWith: null,
+      combo: null,
     };
     cats.push(cat);
     return cat;
@@ -159,7 +205,7 @@ export function createCatEngine(options: {
       if (!cat) return null;
       cat.angry = true;
       cat.petSince = null;
-      setPhase(cat, 'waking', now, config.wakeMs);
+      startWaking(cat, now);
       return cat;
     },
 
@@ -203,7 +249,20 @@ export function createCatEngine(options: {
         // Catch up through every phase that has already ended.
         for (;;) {
           if (cat.phase === 'ready') {
-            if (!tryAttack(cat, type, centreOf(cat))) break;
+            const partner =
+              cat.comboWith === null ? undefined : cats.find((c) => c.id === cat.comboWith);
+            if (partner) {
+              // A combo waits until both are ready, then both pounce as one.
+              if (partner.phase !== 'ready') break;
+              const a = centreOf(cat);
+              const b = centreOf(partner);
+              const combo = findCombo(type.effect.id, typeOf(partner).effect.id)!;
+              const between = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
+              if (!tryAttack(cat, type, between, combo)) break;
+              setPhase(partner, 'attacking', now, config.attackMs);
+            } else if (!tryAttack(cat, type, centreOf(cat))) {
+              break;
+            }
             setPhase(cat, 'attacking', now, config.attackMs);
             changed = true;
             continue;
@@ -215,7 +274,7 @@ export function createCatEngine(options: {
             if (cat.eager) setPhase(cat, 'ready', at, Infinity);
             else setPhase(cat, 'sleeping', at, between(config.sleepMs));
           } else if (cat.phase === 'sleeping') {
-            setPhase(cat, 'waking', at, config.wakeMs);
+            startWaking(cat, at);
           } else if (cat.phase === 'waking') {
             setPhase(cat, 'ready', at, Infinity);
           } else if (cat.phase === 'attacking') {
@@ -230,6 +289,15 @@ export function createCatEngine(options: {
 
       const before = cats.length;
       cats = cats.filter((cat) => cat.phaseEndsAt !== -Infinity);
+      // A pair whose attack is over (or whose partner has gone) is a pair no more.
+      for (const cat of cats) {
+        if (cat.comboWith === null) continue;
+        const partner = cats.find((c) => c.id === cat.comboWith);
+        if (!partner || cat.phase === 'leaving') {
+          cat.comboWith = null;
+          cat.combo = null;
+        }
+      }
       return changed || cats.length !== before;
     },
   };
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index 5a6308a..2ef9731 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -152,7 +152,7 @@ export function XenocatCatsProvider({
       const changed = engine.tick(
         cursor.now(),
         pointer,
-        (cat, type, centre) => {
+        (cat, type, centre, combo) => {
           // No cursor at all (a touch screen, or the pointer not seen yet): the cat
           // pounces at nothing and leaves, rather than waiting on screen for ever.
           if (cursor.position() === null) return true;
@@ -161,13 +161,20 @@ export function XenocatCatsProvider({
           if (!cursor.isPresent()) return false;
           // The page is drawing its own pointer (a locked Fight game): wait until it is done.
           if (cursor.isHidden()) return false;
-          // A cat clicked awake attacks angrily: harder and for longer.
-          const effect = cat.angry
-            ? strengthen(type.effect, engine.config.angryFactor)
-            : type.effect;
+          // A combo attacks with both cats' fused effect; a cat clicked awake (either
+          // of the pair) attacks angrily: harder and for longer.
+          const partner = combo ? engine.cats().find((c) => c.id === cat.comboWith) : undefined;
+          const partnerType = partner
+            ? typesRef.current.find((t) => t.id === partner.typeId)
+            : undefined;
+          const base = combo ? combo.effect : type.effect;
+          const effect =
+            cat.angry || partner?.angry ? strengthen(base, engine.config.angryFactor) : base;
           if (!cursor.attack(effect, centre)) return false;
-          player.play(soundsFor(type).attack);
-          recordStat(type.id, 'survived');
+          for (const attacker of partnerType ? [type, partnerType] : [type]) {
+            player.play(soundsFor(attacker).attack);
+            recordStat(attacker.id, 'survived');
+          }
           return true;
         },
         purr
@@ -297,6 +304,7 @@ function CatView({
       data-cat-type={type.id}
       data-phase={cat.phase}
       data-angry={cat.angry || undefined}
+      data-combo={cat.combo ?? undefined}
       data-petted={cat.petted || undefined}
       className={`absolute ${outer?.className ?? ''} ${cat.angry ? 'xenocat-angry' : ''}`}
       style={style}
diff --git a/app/ui/xenocats/combos.ts b/app/ui/xenocats/combos.ts
new file mode 100644
index 0000000..cc97205
--- /dev/null
+++ b/app/ui/xenocats/combos.ts
@@ -0,0 +1,169 @@
+// Cat combos: two cats waking close together, in place and in time, fuse their
+// attacks into one combined effect (cat-engine.ts pairs them). Each combo is built
+// from the two attacks it fuses, out of three pure ways of combining effects:
+//
+//   layer(a, b)    b applied to where a puts the cursor, while both last
+//   chain(a, b)    a, then b
+//   restyle(a, …)  a, with its look changed (a tint, a fade, a scale)
+
+import {
+  type CursorLook,
+  type Effect,
+  ICE,
+  MAX_EFFECT_MS,
+  blur,
+  bounce,
+  drunk,
+  jitter,
+  knockback,
+  magnet,
+  reverse,
+  teleport,
+  tiny,
+} from './effects';
+
+/** What a combined effect carries between frames: each part's own state and look. */
+type Parts = { a?: unknown; b?: unknown; lookA?: CursorLook; lookB?: CursorLook };
+
+/** `b` applied on top of `a`: `b` sees the cursor where `a` put it as the real pointer. */
+export function layer(a: Effect, b: Effect): Omit<Effect<Parts>, 'id' | 'name' | 'description'> {
+  return {
+    // Only while both run: when one part ended first, the cursor would jump.
+    durationMs: Math.min(a.durationMs, b.durationMs, MAX_EFFECT_MS),
+    step(input) {
+      const own = input.state ?? {};
+      const first = a.step({ ...input, previous: own.lookA ?? input.previous, state: own.a });
+      const second = b.step({
+        ...input,
+        real: { x: first.look.x, y: first.look.y },
+        previous: own.lookB ?? first.look,
+        state: own.b,
+      });
+      return {
+        look: {
+          ...second.look,
+          visible: first.look.visible && second.look.visible,
+          scale: first.look.scale * second.look.scale,
+          blur: first.look.blur + second.look.blur,
+          opacity: first.look.opacity * second.look.opacity,
+          ...(first.look.tint || second.look.tint
+            ? { tint: second.look.tint ?? first.look.tint }
+            : {}),
+          ...(first.look.decoys || second.look.decoys
+            ? { decoys: second.look.decoys ?? first.look.decoys }
+            : {}),
+        },
+        state: { a: first.state, b: second.state, lookA: first.look, lookB: second.look },
+      };
+    },
+  };
+}
+
+/** `a`, then `b` for its own duration (from where `a` left the cursor). */
+export function chain(a: Effect, b: Effect): Omit<Effect<Parts>, 'id' | 'name' | 'description'> {
+  return {
+    durationMs: Math.min(a.durationMs + b.durationMs, MAX_EFFECT_MS),
+    step(input) {
+      const own = input.state ?? {};
+      if (input.elapsed < a.durationMs) {
+        const frame = a.step({ ...input, previous: own.lookA ?? input.previous, state: own.a });
+        return { look: frame.look, state: { ...own, a: frame.state, lookA: frame.look } };
+      }
+      // b starts as if its attack began where a left the cursor.
+      const from = own.lookA ?? input.previous;
+      const frame = b.step({
+        ...input,
+        start: { x: from.x, y: from.y },
+        elapsed: input.elapsed - a.durationMs,
+        previous: own.lookB ?? from,
+        state: own.b,
+      });
+      return { look: frame.look, state: { ...own, b: frame.state, lookB: frame.look } };
+    },
+  };
+}
+
+/** `a` with every frame's look changed by `change`. */
+export function restyle<S>(
+  a: Effect<S>,
+  change: (look: CursorLook, elapsed: number) => Partial<CursorLook>
+): Omit<Effect<S>, 'id' | 'name' | 'description'> {
+  return {
+    durationMs: a.durationMs,
+    amplify: a.amplify,
+    step(input) {
+      const frame = a.step(input);
+      return { ...frame, look: { ...frame.look, ...change(frame.look, input.elapsed) } };
+    },
+  };
+}
+
+export type Combo = {
+  /** The two attacks it fuses, by effect id (in either order). */
+  pair: readonly [string, string];
+  effect: Effect;
+};
+
+const combo = <S>(
+  pair: readonly [string, string],
+  id: string,
+  name: string,
+  description: string,
+  parts: Omit<Effect<S>, 'id' | 'name' | 'description'>
+): Combo => ({ pair, effect: { id, name, description, ...parts } });
+
+export const COMBOS: readonly Combo[] = [
+  combo(
+    ['freeze', 'bounce'],
+    'ice-puck',
+    'Ice puck',
+    'Your frosted cursor skids and ricochets off the edges like an ice puck.',
+    restyle(bounce, () => ({ tint: ICE }))
+  ),
+  combo(
+    ['knockback', 'magnet'],
+    'slingshot',
+    'Slingshot',
+    'Your cursor is flung away, then reeled back in.',
+    chain(knockback, magnet)
+  ),
+  combo(
+    ['reverse', 'drunk'],
+    'hangover',
+    'Hangover',
+    'Your cursor moves the wrong way and sways while it does.',
+    layer(reverse, drunk)
+  ),
+  combo(
+    ['vanish', 'teleport'],
+    'ghost-jump',
+    'Ghost jump',
+    'A faint ghost of your cursor jumps about the screen.',
+    restyle(teleport, () => ({ opacity: 0.35 }))
+  ),
+  combo(
+    ['tiny', 'giant'],
+    'pulsar',
+    'Pulsar',
+    'Your cursor swells to giant size and shrinks to a speck, over and over.',
+    restyle(tiny, (_look, elapsed) => ({
+      // Between a quarter and four times its size, about twice a second.
+      scale: 4 ** Math.sin((2 * Math.PI * elapsed) / 450),
+    }))
+  ),
+  combo(
+    ['jitter', 'blur'],
+    'static-fog',
+    'Static fog',
+    'Your cursor fizzes about in a haze.',
+    // Blur leaves the cursor where jitter put it: still an offset from the pointer.
+    { ...layer(jitter, blur), amplify: 'offset' }
+  ),
+];
+
+/** The combo two attacks fuse into, by their effect ids, if they have one. */
+export function findCombo(a: string, b: string): Combo | undefined {
+  return COMBOS.find(
+    ({ pair }) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a)
+  );
+}
diff --git a/app/ui/xenocats/config.ts b/app/ui/xenocats/config.ts
index a551141..713b06b 100644
--- a/app/ui/xenocats/config.ts
+++ b/app/ui/xenocats/config.ts
@@ -31,6 +31,10 @@ export type CatConfig = {
   petSleepMs: number;
   /** A cat clicked awake is angry: its attack is this many times stronger. */
   angryFactor: number;
+  /** Two cats starting to wake at most this far apart (centre to centre, px)… */
+  comboDistance: number;
+  /** …and at most this long apart (ms) fuse their attacks into a combo. */
+  comboWindowMs: number;
 };
 
 export const CAT_CONFIG: CatConfig = {
@@ -48,4 +52,6 @@ export const CAT_CONFIG: CatConfig = {
   petMs: 1000,
   petSleepMs: 4000,
   angryFactor: 1.5,
+  comboDistance: 220,
+  comboWindowMs: 1500,
 };
diff --git a/app/ui/xenocats/page-hits.ts b/app/ui/xenocats/page-hits.ts
index d4afc7b..5fde0bb 100644
--- a/app/ui/xenocats/page-hits.ts
+++ b/app/ui/xenocats/page-hits.ts
@@ -28,7 +28,7 @@ export type HitStyle = {
   color?: string;
 };
 
-/** Each attack's effect on the page, keyed by effect id. */
+/** Each attack's (and combo's) effect on the page, keyed by effect id. */
 export const PAGE_HITS: Readonly<Record<string, HitStyle>> = {
   vanish: { kind: 'blur', amount: 6 },
   heavy: { kind: 'push', amount: 18, direction: 'down' },
@@ -50,6 +50,13 @@ export const PAGE_HITS: Readonly<Record<string, HitStyle>> = {
   spiral: { kind: 'tilt', amount: 25 },
   bounce: { kind: 'push', amount: 20, direction: 'up' },
   'axis-lock': { kind: 'push', amount: 30, direction: 'sideways' },
+  // The combos (combos.ts), each from its two attacks.
+  'ice-puck': { kind: 'glow', color: '#7dd3fc' },
+  slingshot: { kind: 'push', amount: 50, direction: 'away' },
+  hangover: { kind: 'wobble', amount: 10 },
+  'ghost-jump': { kind: 'swap' },
+  pulsar: { kind: 'shake', amount: 8 },
+  'static-fog': { kind: 'blur', amount: 5 },
 };
 
 /** What a page element can be hit as: the ones that look like controls, text or cards. */
diff --git a/tests/e2e/fight.spec.ts b/tests/e2e/fight.spec.ts
index 1fe63b1..89bce87 100644
--- a/tests/e2e/fight.spec.ts
+++ b/tests/e2e/fight.spec.ts
@@ -44,7 +44,7 @@ async function start(page: Page) {
 test('Survival: banishing every cat of a wave survives it; Esc ends the game and keeps the best score', async ({
   page,
 }) => {
-  test.setTimeout(60_000);
+  test.setTimeout(90_000);
   await openFight(page);
   await expect(page.getByTestId('fight-best')).toHaveText('Best: no waves survived yet');
   await start(page);
@@ -53,16 +53,23 @@ test('Survival: banishing every cat of a wave survives it; Esc ends the game and
   // No cat can be summoned during a game.
   await expect(page.getByTestId('summon-void-tabby')).toBeDisabled();
 
-  // Click every cat that shows up until wave 1 is over.
+  // Click every cat that shows up until wave 1 is over. It is a real-time game: a
+  // cat can reach the pointer while another is being clicked, its effect blocks
+  // clicks, and three such cats end the game; then a new game is started (its
+  // score is 0, so the best score below still comes from the wave survived here).
   await expect
     .poll(
       async () => {
+        if ((await page.getByTestId('fight-overlay').count()) === 0) await start(page);
         const cat = page.getByTestId('fight-cat').first();
-        const box = await cat.boundingBox().catch(() => null);
+        const box = await cat.boundingBox({ timeout: 1000 }).catch(() => null);
         if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
-        return page.getByTestId('fight-wave').getAttribute('data-wave');
+        return page
+          .getByTestId('fight-wave')
+          .getAttribute('data-wave', { timeout: 1000 })
+          .catch(() => null);
       },
-      { timeout: 40_000, intervals: [100] }
+      { timeout: 50_000, intervals: [100] }
     )
     .toBe('2');
   await expect(page.getByTestId('fight-score')).toHaveText('Survived: 1');
diff --git a/tests/e2e/pet-cat.spec.ts b/tests/e2e/pet-cat.spec.ts
index 0be7ecd..1130b68 100644
--- a/tests/e2e/pet-cat.spec.ts
+++ b/tests/e2e/pet-cat.spec.ts
@@ -52,7 +52,9 @@ const tones = (page: Page) => page.evaluate(() => (window as unknown as { tones:
 /** Summons Void Tabby asleep and puts the pointer on it. Returns the cat. */
 async function sleepingCatUnderPointer(page: Page) {
   await page.getByTestId('summon-asleep-void-tabby').click();
-  const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]');
+  // The first one: a click on it can pass through to a Summon button beneath and
+  // bring a second cat (the cats never take clicks).
+  const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]').first();
   await expect(cat).toHaveAttribute('data-phase', 'sleeping');
   const box = (await cat.boundingBox())!;
   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
diff --git a/tests/unit/xenocats/combos.test.ts b/tests/unit/xenocats/combos.test.ts
new file mode 100644
index 0000000..29f06f6
--- /dev/null
+++ b/tests/unit/xenocats/combos.test.ts
@@ -0,0 +1,263 @@
+import { describe, expect, it } from 'vitest';
+import { type Cat, type TryAttack, createCatEngine } from '@/app/ui/xenocats/cat-engine';
+import { CAT_TYPES, catTypeById } from '@/app/ui/xenocats/cat-types';
+import { COMBOS, type Combo, findCombo } from '@/app/ui/xenocats/combos';
+import { CAT_CONFIG } from '@/app/ui/xenocats/config';
+import {
+  type CursorLook,
+  type Effect,
+  ICE,
+  KNOCKBACK_DISTANCE,
+  MAX_EFFECT_MS,
+  knockback,
+  restingLook,
+} from '@/app/ui/xenocats/effects';
+import { PAGE_HITS } from '@/app/ui/xenocats/page-hits';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+const viewport = { width: 1200, height: 800 };
+const cat = { x: 500, y: 400 };
+const start = { x: 600, y: 400 };
+
+/** Runs `effect` for its whole duration, the real pointer moving by `move` each frame. */
+function run(effect: Effect, move = { x: 0, y: 0 }, roll = 0.3) {
+  const looks: CursorLook[] = [];
+  let real = start;
+  let previous = restingLook(real);
+  let state: unknown;
+  for (let elapsed = 0; elapsed < effect.durationMs; elapsed += 16) {
+    const delta = elapsed === 0 ? { x: 0, y: 0 } : move;
+    real = { x: real.x + delta.x, y: real.y + delta.y };
+    const frame = effect.step({
+      real,
+      delta,
+      previous,
+      start,
+      cat,
+      elapsed,
+      dt: 16,
+      viewport,
+      roll,
+      state,
+    });
+    state = frame.state;
+    previous = frame.look;
+    looks.push(frame.look);
+  }
+  return looks;
+}
+
+const comboBy = (id: string) => COMBOS.find((c) => c.effect.id === id)!;
+const effectIds = new Set(CAT_TYPES.map((type) => type.effect.id));
+
+describe('the combos', () => {
+  it('at least five, each from two attacks cats really have, none twice', () => {
+    expect(COMBOS.length).toBeGreaterThanOrEqual(5);
+    const pairs = COMBOS.map(({ pair }) => [...pair].sort().join('+'));
+    expect(new Set(pairs).size).toBe(COMBOS.length);
+    for (const { pair, effect } of COMBOS) {
+      expect(effectIds.has(pair[0]), pair[0]).toBe(true);
+      expect(effectIds.has(pair[1]), pair[1]).toBe(true);
+      expect(pair[0]).not.toBe(pair[1]);
+      expect(effect.durationMs).toBeGreaterThan(0);
+      expect(effect.durationMs).toBeLessThanOrEqual(MAX_EFFECT_MS);
+      expect(effect.name).not.toBe('');
+      expect(effect.description).not.toBe('');
+    }
+  });
+
+  it('each hits the page too, like every attack', () => {
+    for (const { effect } of COMBOS) expect(PAGE_HITS[effect.id], effect.id).toBeDefined();
+  });
+
+  it('an angry combo throws the cursor further only where its parts do', () => {
+    expect(comboBy('ghost-jump').effect.amplify).toBe('offset');
+    expect(comboBy('static-fog').effect.amplify).toBe('offset');
+    expect(comboBy('ice-puck').effect.amplify).toBeUndefined();
+    expect(comboBy('slingshot').effect.amplify).toBeUndefined();
+  });
+
+  it('are found from either cat, and only for their pair', () => {
+    for (const combo of COMBOS) {
+      expect(findCombo(combo.pair[0], combo.pair[1])).toBe(combo);
+      expect(findCombo(combo.pair[1], combo.pair[0])).toBe(combo);
+    }
+    expect(findCombo('freeze', 'vanish')).toBeUndefined();
+    expect(findCombo('freeze', 'freeze')).toBeUndefined();
+  });
+
+  it('Freeze + Bounce = Ice puck: a frosted cursor that skids and ricochets', () => {
+    const looks = run(comboBy('ice-puck').effect, { x: 0, y: 0 });
+    for (const look of looks) expect(look.tint).toBe(ICE);
+    // It moves on its own, with the mouse still.
+    const travelled = looks.reduce(
+      (sum, look, i) =>
+        i ? sum + Math.hypot(look.x - looks[i - 1].x, look.y - looks[i - 1].y) : 0,
+      0
+    );
+    expect(travelled).toBeGreaterThan(300);
+  });
+
+  it('Knockback + Magnet = Slingshot: flung away from the cat, then pulled back to it', () => {
+    const combo = comboBy('slingshot');
+    expect(combo.effect.durationMs).toBe(knockback.durationMs + 4000);
+    const looks = run(combo.effect);
+    const dist = (look: CursorLook) => Math.hypot(look.x - cat.x, look.y - cat.y);
+    const flung = looks[Math.floor(knockback.durationMs / 16) - 1];
+    expect(dist(flung)).toBeGreaterThan(
+      Math.hypot(start.x - cat.x, start.y - cat.y) + KNOCKBACK_DISTANCE / 2
+    );
+    expect(dist(looks.at(-1)!)).toBeLessThan(dist(flung) / 2);
+  });
+
+  it('Reverse + Drunk = Hangover: moves against the mouse, and sways', () => {
+    const looks = run(comboBy('hangover').effect, { x: 3, y: 0 });
+    // The mouse went right; the cursor went left overall.
+    expect(looks.at(-1)!.x).toBeLessThan(start.x - 50);
+    // …and its height sways though the mouse moved only sideways.
+    const ys = looks.map((look) => look.y);
+    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(20);
+  });
+
+  it('Vanish + Teleport = Ghost jump: a faint cursor that jumps about', () => {
+    const looks = run(comboBy('ghost-jump').effect);
+    for (const look of looks) expect(look.opacity).toBeCloseTo(0.35);
+    const spots = new Set(looks.map((look) => `${Math.round(look.x)},${Math.round(look.y)}`));
+    expect(spots.size).toBeGreaterThanOrEqual(3);
+  });
+
+  it('Tiny + Giant = Pulsar: swells to giant and shrinks to a speck, again and again', () => {
+    const scales = run(comboBy('pulsar').effect).map((look) => look.scale);
+    expect(Math.max(...scales)).toBeGreaterThan(3.5);
+    expect(Math.min(...scales)).toBeLessThan(0.3);
+    const peaks = scales.filter(
+      (s, i) => i > 0 && i < scales.length - 1 && s > scales[i - 1] && s >= scales[i + 1]
+    );
+    expect(peaks.length).toBeGreaterThanOrEqual(3);
+  });
+
+  it('Jitter + Blur = Static fog: a blurred cursor fizzing about the pointer', () => {
+    const looks = run(comboBy('static-fog').effect);
+    for (const look of looks.slice(0, 50)) expect(look.blur).toBeGreaterThan(0);
+    const spots = new Set(looks.slice(0, 50).map((look) => `${look.x},${look.y}`));
+    expect(spots.size).toBeGreaterThan(5);
+    for (const look of looks)
+      expect(Math.hypot(look.x - start.x, look.y - start.y)).toBeLessThan(40);
+  });
+});
+
+/** An engine with two sleeping cats of `a` and `b` side by side (centres 100 px apart). */
+function pairOfSleepers(a: string, b: string, gap = 100) {
+  const engine = createCatEngine({
+    random: createRandom(9),
+    types: CAT_TYPES,
+    viewport,
+    autoSpawn: false,
+  });
+  const one = engine.summon(a, 0, null, { asleep: true })!;
+  const two = engine.summon(b, 0, null, { asleep: true })!;
+  Object.assign(one, { x: 300, y: 300 });
+  Object.assign(two, { x: 300 + gap, y: 300 });
+  const entrance = Math.max(catTypeById(a)!.entranceMs, catTypeById(b)!.entranceMs);
+  engine.tick(entrance, null, () => false);
+  expect([one.phase, two.phase]).toEqual(['sleeping', 'sleeping']);
+  return { engine, one, two, at: entrance };
+}
+
+const centre = (c: Cat) => ({ x: c.x + CAT_CONFIG.catSize / 2, y: c.y + CAT_CONFIG.catSize / 2 });
+
+/** Ticks to `until`, recording every attack accepted. */
+function attacks(engine: ReturnType<typeof createCatEngine>, from: number, until: number) {
+  const seen: { cat: Cat; centre: { x: number; y: number }; combo?: Combo }[] = [];
+  const accept: TryAttack = (c, _type, at, combo) => {
+    seen.push({ cat: { ...c }, centre: at, combo });
+    return true;
+  };
+  for (let now = from; now <= until; now += 16) engine.tick(now, null, accept);
+  return seen;
+}
+
+describe('cats pairing up for a combo', () => {
+  it('two cats waking close together attack once, together, with the combo', () => {
+    // Cryo Persian (freeze) and Pinball Devon (bounce): an ice puck.
+    const { engine, one, two, at } = pairOfSleepers('cryo-persian', 'pinball-devon');
+    engine.poke(centre(one), at + 100);
+    engine.poke(centre(two), at + 100 + CAT_CONFIG.comboWindowMs - 10);
+    expect(one.combo).toBe('ice-puck');
+    expect(two.comboWith).toBe(one.id);
+    const seen = attacks(engine, at + 200, at + 200 + CAT_CONFIG.comboWindowMs + 3000);
+    expect(seen).toHaveLength(1);
+    expect(seen[0].combo?.effect.id).toBe('ice-puck');
+    // It comes from between the two cats.
+    expect(seen[0].centre).toEqual({
+      x: (centre(one).x + centre(two).x) / 2,
+      y: centre(one).y,
+    });
+    expect(engine.cats().every((c) => c.phase === 'attacking' || c.phase === 'leaving')).toBe(true);
+  });
+
+  it('two cats that wake on their own close together pair up too', () => {
+    const engine = createCatEngine({
+      random: createRandom(9),
+      types: CAT_TYPES,
+      viewport,
+      autoSpawn: false,
+      // Both sleep (almost) exactly 5 s.
+      config: { sleepMs: [5000, 5001] },
+    });
+    const one = engine.summon('pulsar-siamese', 0, null, { asleep: true })!;
+    const two = engine.summon('magneto-bengal', 0, null, { asleep: true })!;
+    Object.assign(one, { x: 300, y: 300 });
+    Object.assign(two, { x: 400, y: 300 });
+    const seen = attacks(engine, 0, 12_000);
+    expect(seen).toHaveLength(1);
+    expect(seen[0].combo?.effect.id).toBe('slingshot');
+  });
+
+  it('too far apart in time: no combo, each attacks alone', () => {
+    const { engine, one, two, at } = pairOfSleepers('cryo-persian', 'pinball-devon');
+    engine.poke(centre(one), at + 100);
+    engine.poke(centre(two), at + 100 + CAT_CONFIG.comboWindowMs + 10);
+    expect(one.combo).toBeNull();
+    const seen = attacks(engine, at + 200, at + 12_000);
+    expect(seen.map((s) => s.combo)).toEqual([undefined, undefined]);
+  });
+
+  it('too far apart in place: no combo', () => {
+    const { engine, one, two, at } = pairOfSleepers(
+      'cryo-persian',
+      'pinball-devon',
+      CAT_CONFIG.comboDistance + 10
+    );
+    engine.poke(centre(one), at + 100);
+    engine.poke(centre(two), at + 150);
+    expect(one.combo).toBeNull();
+    expect(two.combo).toBeNull();
+  });
+
+  it('cats whose attacks have no combo do not pair', () => {
+    const { engine, one, two, at } = pairOfSleepers('void-tabby', 'cryo-persian');
+    engine.poke(centre(one), at + 100);
+    engine.poke(centre(two), at + 150);
+    expect(one.comboWith).toBeNull();
+  });
+
+  it('only one combo at a time', () => {
+    const engine = createCatEngine({
+      random: createRandom(9),
+      types: CAT_TYPES,
+      viewport,
+      autoSpawn: false,
+    });
+    const ids = ['cryo-persian', 'pinball-devon', 'pulsar-siamese', 'magneto-bengal'];
+    const four = ids.map((id) => engine.summon(id, 0, null, { asleep: true })!);
+    four.forEach((c, i) =>
+      Object.assign(c, { x: 200 + (i % 2) * 90, y: 200 + Math.floor(i / 2) * 90 })
+    );
+    engine.tick(2000, null, () => false);
+    for (const c of four) engine.poke(centre(c), 2100);
+    expect(four.filter((c) => c.combo !== null)).toHaveLength(2);
+    expect(four[0].combo).toBe('ice-puck');
+    expect(four[2].combo).toBeNull();
+  });
+});
~~~~

</details>

#### T8 — `night-2026-10-01-t8-touch`

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

<details><summary>Code:  5 files changed, 200 insertions(+), 11 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 08afca7..ef0a88c 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -112,9 +112,9 @@ jobs:
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
-      - name: Browser tests against next start (cats, petting)
+      - name: Browser tests against next start (cats, petting, touch)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
-        run: npx playwright test tests/e2e/cats tests/e2e/pet-cat --output test-results/cats
+        run: npx playwright test tests/e2e/cats tests/e2e/pet-cat tests/e2e/touch --output test-results/cats
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
@@ -178,9 +178,9 @@ jobs:
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
-      - name: Browser tests (cats, petting)
+      - name: Browser tests (cats, petting, touch)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
-        run: npx playwright test tests/e2e/cats tests/e2e/pet-cat --output test-results/cats
+        run: npx playwright test tests/e2e/cats tests/e2e/pet-cat tests/e2e/touch --output test-results/cats
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/cats
       - name: Browser tests (fight)
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index 2ef9731..399cd49 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -153,12 +153,14 @@ export function XenocatCatsProvider({
         cursor.now(),
         pointer,
         (cat, type, centre, combo) => {
-          // No cursor at all (a touch screen, or the pointer not seen yet): the cat
-          // pounces at nothing and leaves, rather than waiting on screen for ever.
-          if (cursor.position() === null) return true;
+          // A touch screen (no fake cursor) attacks the page around the last touch.
+          // No cursor and no touch yet: the cat pounces at nothing and leaves, rather
+          // than waiting on screen for ever.
+          const touch = cursor.touchPoint();
+          if (touch === null && cursor.position() === null) return true;
           // The pointer is off the page: wait, rather than block clicks with an effect
           // nobody sees.
-          if (!cursor.isPresent()) return false;
+          if (touch === null && !cursor.isPresent()) return false;
           // The page is drawing its own pointer (a locked Fight game): wait until it is done.
           if (cursor.isHidden()) return false;
           // A combo attacks with both cats' fused effect; a cat clicked awake (either
diff --git a/app/ui/xenocats/fake-cursor.tsx b/app/ui/xenocats/fake-cursor.tsx
index 2376d90..50a70b9 100644
--- a/app/ui/xenocats/fake-cursor.tsx
+++ b/app/ui/xenocats/fake-cursor.tsx
@@ -14,6 +14,11 @@ export type XenocatCursor = {
   isBusy(): boolean;
   /** Where the fake cursor is, or null before the pointer has been seen. */
   position(): Vec | null;
+  /**
+   * On a touch screen (no fake cursor): where the screen was last touched, or null.
+   * An attack there hits only the page elements around that point.
+   */
+  touchPoint(): Vec | null;
   /** False while the pointer is outside the page; nobody would see an attack. */
   isPresent(): boolean;
   /** The clock the cursor runs on; cats use the same one. */
@@ -61,6 +66,10 @@ const PRESS_ENDS = new Set(['click', 'auxclick', 'contextmenu']);
 
 export const HIDE_CURSOR_CLASS = 'xenocat-cursor-hidden';
 
+// What a tap can do (mousedown focuses a field); blocked on a touch screen while a
+// cat's attack hits the page. Nothing that starts a scroll is.
+const TOUCH_BLOCKED = ['mousedown', 'click', 'dblclick', 'contextmenu'] as const;
+
 /** Draws a cursor element (or one of its decoys) at `at`, looking as `look` says. */
 export function placeCursor(element: HTMLElement, at: Vec, look: CursorLook) {
   const filter = [
@@ -102,6 +111,10 @@ export function XenocatCursorProvider({
   const hiddenRef = useRef(false);
   // Puts back the page elements the running attack hit (page-hits.ts).
   const restoreHitsRef = useRef<(() => void) | null>(null);
+  // Touch screens: the last touch, and until when a touch attack runs.
+  const touchRef = useRef<Vec | null>(null);
+  const touchUntilRef = useRef(0);
+  const touchTimerRef = useRef(0);
 
   useEffect(() => {
     nowRef.current = now;
@@ -210,9 +223,60 @@ export function XenocatCursorProvider({
     };
   }, [enabled, controller]);
 
+  // Touch screens: no fake cursor, but cats still attack the page around the last
+  // touch, and taps are blocked while they do (as clicks are with a cursor).
+  useEffect(() => {
+    if (enabled) return;
+    const endTouchHit = () => {
+      window.clearTimeout(touchTimerRef.current);
+      touchUntilRef.current = 0;
+      restoreHitsRef.current?.();
+      restoreHitsRef.current = null;
+    };
+    const onDown = (event: PointerEvent) => {
+      if (event.pointerType !== 'mouse') touchRef.current = { x: event.clientX, y: event.clientY };
+    };
+    const onActivate = (event: Event) => {
+      if (touchUntilRef.current === 0) return;
+      if (nowRef.current() >= touchUntilRef.current) {
+        endTouchHit();
+        return;
+      }
+      // Only a tap: a keyboard-made click has detail 0, and is never blocked.
+      if ((event as MouseEvent).detail === 0) return;
+      event.preventDefault();
+      event.stopPropagation();
+    };
+    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
+    for (const type of TOUCH_BLOCKED) window.addEventListener(type, onActivate, true);
+    return () => {
+      endTouchHit();
+      window.removeEventListener('pointerdown', onDown, { capture: true });
+      for (const type of TOUCH_BLOCKED) window.removeEventListener(type, onActivate, true);
+    };
+  }, [enabled]);
+
   const api = useMemo<XenocatCursor>(
     () => ({
       attack: (effect, cat) => {
+        if (!enabled) {
+          // A touch screen: hit the page around the last touch, for the effect's time.
+          const touch = touchRef.current;
+          const time = nowRef.current();
+          if (!touch || time < touchUntilRef.current) return false;
+          restoreHitsRef.current?.();
+          restoreHitsRef.current = hitPage(document.body, effect.id, touch, cat, random);
+          // Nothing near the touch: the cat pounces at nothing, and no tap is blocked.
+          if (!restoreHitsRef.current) return true;
+          touchUntilRef.current = time + effect.durationMs;
+          window.clearTimeout(touchTimerRef.current);
+          touchTimerRef.current = window.setTimeout(() => {
+            touchUntilRef.current = 0;
+            restoreHitsRef.current?.();
+            restoreHitsRef.current = null;
+          }, effect.durationMs);
+          return true;
+        }
         if (!controller.attack(effect, cat, nowRef.current())) return false;
         // Every attack also hits the page around the pointer, for as long as it lasts.
         const pointer = controller.position();
@@ -222,8 +286,12 @@ export function XenocatCursorProvider({
           : null;
         return true;
       },
-      isBusy: () => controller.isBlocking(nowRef.current()),
+      isBusy: () =>
+        enabled
+          ? controller.isBlocking(nowRef.current())
+          : nowRef.current() < touchUntilRef.current,
       position: () => controller.position(),
+      touchPoint: () => (enabled ? null : touchRef.current),
       isPresent: () => controller.isPresent(),
       now: () => nowRef.current(),
       random,
@@ -232,7 +300,7 @@ export function XenocatCursorProvider({
       },
       isHidden: () => hiddenRef.current,
     }),
-    [controller, random]
+    [controller, random, enabled]
   );
 
   const layer = 'pointer-events-none fixed left-0 top-0 z-[9999] origin-top-left';
diff --git a/tests/e2e/touch.spec.ts b/tests/e2e/touch.spec.ts
new file mode 100644
index 0000000..dd8881e
--- /dev/null
+++ b/tests/e2e/touch.spec.ts
@@ -0,0 +1,47 @@
+import { devices, expect, test } from '@playwright/test';
+
+// Cats on a touch screen (/cats, no login, no database): a phone profile, so the
+// page sees a coarse pointer and touch input.
+test.use({ ...devices['Pixel 7'] });
+
+test('on a touch screen the fake cursor stays off, and a cat attacks the page around the last touch', async ({
+  page,
+}) => {
+  test.setTimeout(30_000);
+  await page.goto('/cats');
+  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
+
+  // Pulsar Siamese's knockback pushes the page elements around the touch.
+  const button = page.getByTestId('summon-pulsar-siamese');
+  await button.scrollIntoViewIfNeeded();
+  // A tap before hydration is lost; tap until the cat comes.
+  await expect
+    .poll(async () => {
+      if ((await page.getByTestId('xenocat').count()) === 0) await button.tap();
+      return page.getByTestId('xenocat').count();
+    })
+    .toBe(1);
+
+  // No fake cursor, and the system cursor is not hidden.
+  await expect(page.getByTestId('fake-cursor')).toHaveCount(0);
+  expect(await page.locator('html').getAttribute('class')).not.toContain('xenocat-cursor-hidden');
+
+  // Once the cat has arrived it attacks: the button that was touched is pushed…
+  const before = await button.evaluate((el) =>
+    el.outerHTML.replace(/ data-xenocat-hit="[^"]*"/, '')
+  );
+  await expect(button).toHaveAttribute('data-xenocat-hit', 'push', { timeout: 5000 });
+  // …and a tap meanwhile does nothing: the card's other Summon button does not
+  // summon (its status message never appears).
+  const status = page.getByTestId('summon-status');
+  const asleep = page.getByTestId('summon-asleep-pulsar-siamese');
+  await asleep.tap();
+  await page.waitForTimeout(300);
+  await expect(status).not.toContainText('will nap');
+  // When the effect is over (1.5 s) it is exactly as it was.
+  await expect(button).not.toHaveAttribute('data-xenocat-hit', { timeout: 5000 });
+  expect(await button.evaluate((el) => el.outerHTML)).toBe(before);
+  // The same tap works again now.
+  await asleep.tap();
+  await expect(status).toContainText('Pulsar Siamese is on its way, and will nap');
+});
diff --git a/tests/unit/xenocats/fake-cursor.test.tsx b/tests/unit/xenocats/fake-cursor.test.tsx
index fa0f752..6631bc6 100644
--- a/tests/unit/xenocats/fake-cursor.test.tsx
+++ b/tests/unit/xenocats/fake-cursor.test.tsx
@@ -2,7 +2,7 @@
 import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
 import { useEffect } from 'react';
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
-import { vanish } from '@/app/ui/xenocats/effects';
+import { jitter, vanish } from '@/app/ui/xenocats/effects';
 import {
   HIDE_CURSOR_CLASS,
   type XenocatCursor,
@@ -312,3 +312,75 @@ describe('XenocatCursorProvider', () => {
     expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
   });
 });
+
+describe('on a touch screen', () => {
+  // A short effect, so the test waits for its real end.
+  const quickJitter = { ...jitter, durationMs: 60 };
+
+  it('draws no fake cursor, but attacks the page around the last touch, then puts it back', async () => {
+    mockPointer(false);
+    const onClick = renderPage();
+    expect(screen.queryByTestId('fake-cursor')).toBeNull();
+    const save = screen.getByText('Save');
+    save.getBoundingClientRect = () =>
+      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
+    const before = save.outerHTML;
+
+    // No touch yet: nothing to attack.
+    expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(false);
+    expect(cursor.touchPoint()).toBeNull();
+
+    fireEvent.pointerDown(window, { clientX: 10, clientY: 10, pointerType: 'touch' });
+    expect(cursor.touchPoint()).toEqual({ x: 10, y: 10 });
+    expect(cursor.position()).toBeNull();
+    act(() => {
+      expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(true);
+    });
+    expect(save.getAttribute('data-xenocat-hit')).toBe('shake');
+    expect(cursor.isBusy()).toBe(true);
+    // One at a time.
+    expect(cursor.attack(quickJitter, { x: 300, y: 300 })).toBe(false);
+    // A tap is blocked while the page is hit; a keyboard click is not.
+    fireEvent.click(save, { detail: 1 });
+    expect(onClick).not.toHaveBeenCalled();
+    fireEvent.click(save, { detail: 0 });
+    expect(onClick).toHaveBeenCalledTimes(1);
+
+    clock = quickJitter.durationMs;
+    await waitFor(() => expect(save.outerHTML).toBe(before));
+    expect(cursor.isBusy()).toBe(false);
+    fireEvent.click(save, { detail: 1 });
+    expect(onClick).toHaveBeenCalledTimes(2);
+  });
+
+  it('a touch far from everything: the cat pounces at nothing and no tap is blocked', () => {
+    mockPointer(false);
+    const onClick = renderPage();
+    const save = screen.getByText('Save');
+    save.getBoundingClientRect = () =>
+      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
+    fireEvent.pointerDown(window, { clientX: 900, clientY: 700, pointerType: 'touch' });
+    act(() => {
+      expect(cursor.attack({ ...jitter, durationMs: 5000 }, { x: 300, y: 300 })).toBe(true);
+    });
+    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
+    expect(cursor.isBusy()).toBe(false);
+    fireEvent.click(save, { detail: 1 });
+    expect(onClick).toHaveBeenCalledTimes(1);
+  });
+
+  it('puts the page back if it goes away mid-attack', () => {
+    mockPointer(false);
+    renderPage();
+    const save = screen.getByText('Save');
+    save.getBoundingClientRect = () =>
+      ({ left: 0, top: 0, right: 60, bottom: 20, x: 0, y: 0, width: 60, height: 20 }) as DOMRect;
+    fireEvent.pointerDown(window, { clientX: 10, clientY: 10, pointerType: 'touch' });
+    act(() => {
+      cursor.attack({ ...jitter, durationMs: 5000 }, { x: 300, y: 300 });
+    });
+    expect(save.hasAttribute('data-xenocat-hit')).toBe(true);
+    cleanup();
+    expect(save.hasAttribute('data-xenocat-hit')).toBe(false);
+  });
+});
~~~~

</details>

#### T9 — `night-2026-10-01-t9-keys-indexes`

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

<details><summary>Code:  4 files changed, 69 insertions(+), 7 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index ef0a88c..066cdaf 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -30,7 +30,7 @@ jobs:
         if: ${{ !cancelled() }}
         run: >-
           npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
-          tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher
+          tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher tests/unit/seed-data
       - name: Unit tests (cats, Node)
         if: ${{ !cancelled() }}
         run: >-
diff --git a/db/migrations/0002_invoice_keys_and_indexes.sql b/db/migrations/0002_invoice_keys_and_indexes.sql
new file mode 100644
index 0000000..5c7dc33
--- /dev/null
+++ b/db/migrations/0002_invoice_keys_and_indexes.sql
@@ -0,0 +1,19 @@
+-- An invoice belongs to a customer that exists, and a customer who still has
+-- invoices cannot be deleted. Written to apply to a database that already holds
+-- data: it adds to the tables and changes no row. On a database with an invoice
+-- whose customer is missing it fails, and changes nothing (each migration runs in
+-- one transaction): such an invoice must be fixed first. It blocks writes to
+-- invoices and customers while it runs: on a large live table, apply it when quiet.
+ALTER TABLE invoices
+  ADD CONSTRAINT invoices_customer_id_fkey
+  FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE RESTRICT;
+
+-- The invoice list joins customers on customer_id (as does the search), and
+-- deleting a customer looks up their invoices by it.
+CREATE INDEX invoices_customer_id_idx ON invoices (customer_id);
+
+-- The invoice list, the latest invoices and the date ranges sort and filter by date.
+CREATE INDEX invoices_date_idx ON invoices (date DESC);
+
+-- Filtering by status, newest first.
+CREATE INDEX invoices_status_date_idx ON invoices (status, date DESC);
diff --git a/tests/e2e/cats.spec.ts b/tests/e2e/cats.spec.ts
index 6ae231d..e8db614 100644
--- a/tests/e2e/cats.spec.ts
+++ b/tests/e2e/cats.spec.ts
@@ -327,17 +327,26 @@ test('the stomp shake never moves the cats or the cursor, even on a scrolled pag
   // Sample while the shake class is on: the cat and the cursor must stay put.
   const samples = await page.evaluate(
     () =>
-      new Promise<{ catY: number; cursor: string }[]>((resolve) => {
+      new Promise<{ cat: string; layer: string; cursor: string }[]>((resolve) => {
         const target = document.querySelector('[data-testid="xenocat-page"]')!;
         // The last frame before the shake is the baseline; then five frames during it.
-        const out: { catY: number; cursor: string }[] = [];
-        let before: { catY: number; cursor: string } | null = null;
+        // The cat's own arrival animation moves its drawn box, so what is compared
+        // is what a scroll jump would move: the cat layer's box and the cat's place
+        // in it (offsetTop/offsetLeft ignore its animation), and the cursor.
+        const out: { cat: string; layer: string; cursor: string }[] = [];
+        let before: { cat: string; layer: string; cursor: string } | null = null;
         const sample = () => {
-          const cat = document.querySelector('[data-testid="xenocat"]');
+          const cat = document.querySelector('[data-testid="xenocat"]') as HTMLElement | null;
+          const layer = document.querySelector('[data-testid="xenocat-layer"]')!;
           const cursor = document.querySelector('[data-testid="fake-cursor"]') as HTMLElement;
           if (cat) {
             const box = cursor.getBoundingClientRect();
-            const now = { catY: cat.getBoundingClientRect().top, cursor: `${box.left},${box.top}` };
+            const layerBox = layer.getBoundingClientRect();
+            const now = {
+              cat: `${cat.offsetLeft},${cat.offsetTop}`,
+              layer: `${layerBox.left},${layerBox.top}`,
+              cursor: `${box.left},${box.top}`,
+            };
             if (!target.classList.contains('xenocat-shake')) before = now;
             else {
               if (out.length === 0 && before) out.push(before);
@@ -354,7 +363,8 @@ test('the stomp shake never moves the cats or the cursor, even on a scrolled pag
   expect(samples.length).toBeGreaterThan(0);
   const before = samples[0];
   for (const s of samples) {
-    expect(Math.abs(s.catY - before.catY)).toBeLessThan(40); // the stomp's own squash, not a scroll jump
+    expect(s.cat).toBe(before.cat);
+    expect(s.layer).toBe(before.layer);
     expect(s.cursor).toBe(before.cursor);
   }
   // The cursor is still drawn at the pointer.
diff --git a/tests/unit/seed-data.test.ts b/tests/unit/seed-data.test.ts
new file mode 100644
index 0000000..13b5b59
--- /dev/null
+++ b/tests/unit/seed-data.test.ts
@@ -0,0 +1,33 @@
+import { readFileSync, readdirSync } from 'node:fs';
+import { describe, expect, it } from 'vitest';
+import { customers, invoices } from '@/app/lib/placeholder-data';
+
+// The seed (npm run db:seed) must satisfy the schema's keys, or seeding fails.
+
+describe('the seed data', () => {
+  it('names an existing customer on every invoice (invoices_customer_id_fkey)', () => {
+    const ids = new Set(customers.map((customer) => customer.id));
+    for (const invoice of invoices) expect(ids.has(invoice.customer_id)).toBe(true);
+  });
+
+  it('has unique customer ids', () => {
+    expect(new Set(customers.map((customer) => customer.id)).size).toBe(customers.length);
+  });
+});
+
+describe('the migrations', () => {
+  const dir = new URL('../../db/migrations/', import.meta.url);
+  const files = readdirSync(dir)
+    .filter((name) => name.endsWith('.sql'))
+    .sort();
+
+  it('are numbered in order, without gaps', () => {
+    files.forEach((name, i) => expect(name.slice(0, 4)).toBe(String(i + 1).padStart(4, '0')));
+  });
+
+  it('add the invoice key and indexes without dropping anything', () => {
+    const body = readFileSync(new URL('0002_invoice_keys_and_indexes.sql', dir), 'utf8');
+    expect(body).toMatch(/REFERENCES customers \(id\) ON DELETE RESTRICT/);
+    expect(body).not.toMatch(/\bDROP\b/i);
+  });
+});
~~~~

</details>

#### T10 — `night-2026-10-01-t10-customer-crud`

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

<details><summary>Code:  17 files changed, 679 insertions(+), 101 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 066cdaf..302fff3 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -104,10 +104,11 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard)
+      - name: Browser tests against next start (smoke, branding, dashboard, customers)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
+          tests/e2e/customers
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -171,10 +172,11 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard)
+      - name: Browser tests (smoke, branding, dashboard, customers)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
+          tests/e2e/customers
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/app/dashboard/customers/[id]/edit/not-found.tsx b/app/dashboard/customers/[id]/edit/not-found.tsx
new file mode 100644
index 0000000..fce7b6b
--- /dev/null
+++ b/app/dashboard/customers/[id]/edit/not-found.tsx
@@ -0,0 +1,18 @@
+import Link from 'next/link';
+import { FaceFrownIcon } from '@heroicons/react/24/solid';
+
+export default function NotFound() {
+  return (
+    <main className="flex h-full flex-col items-center justify-center gap-2">
+      <FaceFrownIcon className="w-10 text-aura" />
+      <h2 className="text-xl font-semibold text-white">404 Not Found</h2>
+      <p className="text-aura">Could not find the requested customer.</p>
+      <Link
+        href="/dashboard/customers"
+        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
+      >
+        Go Back
+      </Link>
+    </main>
+  );
+}
diff --git a/app/dashboard/customers/[id]/edit/page.tsx b/app/dashboard/customers/[id]/edit/page.tsx
new file mode 100644
index 0000000..f337f44
--- /dev/null
+++ b/app/dashboard/customers/[id]/edit/page.tsx
@@ -0,0 +1,29 @@
+import { Metadata } from 'next';
+import { notFound } from 'next/navigation';
+import { fetchCustomerById } from '@/app/lib/data';
+import { CustomerId } from '@/app/lib/schemas';
+import CustomerForm from '@/app/ui/customers/customer-form';
+import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
+
+export const metadata: Metadata = {
+  title: 'Edit Customer',
+};
+
+export default async function Page(props: { params: Promise<{ id: string }> }) {
+  const { id } = await props.params;
+  // Anything but a UUID names no customer (and would be a database error).
+  const customer = CustomerId.safeParse(id).success ? await fetchCustomerById(id) : undefined;
+  if (!customer) notFound();
+
+  return (
+    <main>
+      <Breadcrumbs
+        breadcrumbs={[
+          { label: 'Customers', href: '/dashboard/customers' },
+          { label: 'Edit Customer', href: `/dashboard/customers/${id}/edit`, active: true },
+        ]}
+      />
+      <CustomerForm customer={customer} />
+    </main>
+  );
+}
diff --git a/app/dashboard/customers/create/page.tsx b/app/dashboard/customers/create/page.tsx
new file mode 100644
index 0000000..7a206bd
--- /dev/null
+++ b/app/dashboard/customers/create/page.tsx
@@ -0,0 +1,21 @@
+import { Metadata } from 'next';
+import CustomerForm from '@/app/ui/customers/customer-form';
+import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
+
+export const metadata: Metadata = {
+  title: 'Create Customer',
+};
+
+export default function Page() {
+  return (
+    <main>
+      <Breadcrumbs
+        breadcrumbs={[
+          { label: 'Customers', href: '/dashboard/customers' },
+          { label: 'Create Customer', href: '/dashboard/customers/create', active: true },
+        ]}
+      />
+      <CustomerForm />
+    </main>
+  );
+}
diff --git a/app/dashboard/customers/error.tsx b/app/dashboard/customers/error.tsx
new file mode 100644
index 0000000..2ca5f54
--- /dev/null
+++ b/app/dashboard/customers/error.tsx
@@ -0,0 +1,27 @@
+'use client';
+
+import { useEffect } from 'react';
+
+export default function Error({
+  error,
+  reset,
+}: {
+  error: Error & { digest?: string };
+  reset: () => void;
+}) {
+  useEffect(() => {
+    console.error(error);
+  }, [error]);
+
+  return (
+    <main className="flex h-full flex-col items-center justify-center">
+      <h2 className="text-center text-lg font-semibold text-white">Something went wrong!</h2>
+      <button
+        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
+        onClick={() => reset()}
+      >
+        Try again
+      </button>
+    </main>
+  );
+}
diff --git a/app/dashboard/customers/page.tsx b/app/dashboard/customers/page.tsx
index 368ac8f..2f741b0 100644
--- a/app/dashboard/customers/page.tsx
+++ b/app/dashboard/customers/page.tsx
@@ -1,9 +1,28 @@
-import { Metadata } from 'next';
-
-export const metadata: Metadata = {
-  title: 'Customers',
-};
-
-export default function Page() {
-  return <p> Customers Page </p>;
-}
+import { Metadata } from 'next';
+import { fetchFilteredCustomers } from '@/app/lib/data';
+import { CreateCustomer } from '@/app/ui/customers/buttons';
+import CustomersTable from '@/app/ui/customers/table';
+import Search from '@/app/ui/search';
+
+export const metadata: Metadata = {
+  title: 'Customers',
+};
+
+export default async function Page(props: { searchParams?: Promise<{ query?: string }> }) {
+  const searchParams = await props.searchParams;
+  const query = searchParams?.query || '';
+  const customers = await fetchFilteredCustomers(query);
+
+  return (
+    <div className="w-full">
+      <h1 className="font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
+        Customers
+      </h1>
+      <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
+        <Search placeholder="Search customers..." />
+        <CreateCustomer />
+      </div>
+      <CustomersTable customers={customers} />
+    </div>
+  );
+}
diff --git a/app/dashboard/invoices/create/page.tsx b/app/dashboard/invoices/create/page.tsx
index 3f9ed6f..5bc0e19 100644
--- a/app/dashboard/invoices/create/page.tsx
+++ b/app/dashboard/invoices/create/page.tsx
@@ -2,12 +2,16 @@ import Form from '@/app/ui/invoices/create-form';
 import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
 import { fetchCustomers } from '@/app/lib/data';
 import { Metadata } from 'next';
+import { connection } from 'next/server';
 
 export const metadata: Metadata = {
   title: 'Create Invoice',
 };
 
 export default async function Page() {
+  // Rendered per request, not once at build time: the customer list changes
+  // whenever a customer is created, renamed or deleted.
+  await connection();
   const customers = await fetchCustomers();
 
   return (
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index fbe9338..fdd9411 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -5,7 +5,7 @@ import { redirect } from 'next/navigation';
 import postgres from 'postgres';
 import { auth, signIn } from '@/auth';
 import { AuthError } from 'next-auth';
-import { CreateInvoice, UpdateInvoice } from '@/app/lib/schemas';
+import { CreateInvoice, CustomerForm, CustomerId, UpdateInvoice } from '@/app/lib/schemas';
 
 const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
@@ -121,6 +121,118 @@ export async function deleteInvoice(id: string) {
   revalidatePath('/dashboard/invoices');
 }
 
+export type CustomerState = {
+  errors?: {
+    name?: string[];
+    email?: string[];
+  };
+  message?: string | null;
+};
+
+// Every customer gets the same stored image: avatars are drawn from the name
+// (app/ui/customer-avatar.tsx), and the column cannot be empty.
+const CUSTOMER_IMAGE = '/xenocats/avatar-1.webp';
+
+/** What shows customers: their list, the invoice list (names) and the invoice form. */
+function revalidateCustomers() {
+  revalidatePath('/dashboard/customers');
+  revalidatePath('/dashboard/invoices');
+  revalidatePath('/dashboard/invoices/create');
+}
+
+export async function createCustomer(prevState: CustomerState, formData: FormData) {
+  if (!(await isSignedIn())) {
+    return { message: 'You must be logged in to create a customer.' };
+  }
+
+  const validatedFields = CustomerForm.safeParse({
+    name: formData.get('name'),
+    email: formData.get('email'),
+  });
+  if (!validatedFields.success) {
+    return {
+      errors: validatedFields.error.flatten().fieldErrors,
+      message: 'Missing or invalid fields. Failed to create the customer.',
+    };
+  }
+
+  const { name, email } = validatedFields.data;
+  try {
+    await sql`
+      INSERT INTO customers (name, email, image_url)
+      VALUES (${name}, ${email}, ${CUSTOMER_IMAGE})
+    `;
+  } catch (error) {
+    console.error('Database Error:', error);
+    return { message: 'Database Error: Failed to create the customer.' };
+  }
+
+  revalidateCustomers();
+  redirect('/dashboard/customers');
+}
+
+export async function updateCustomer(id: string, prevState: CustomerState, formData: FormData) {
+  if (!(await isSignedIn())) {
+    return { message: 'You must be logged in to update a customer.' };
+  }
+  if (!CustomerId.safeParse(id).success) {
+    return { message: 'That customer does not exist.' };
+  }
+
+  const validatedFields = CustomerForm.safeParse({
+    name: formData.get('name'),
+    email: formData.get('email'),
+  });
+  if (!validatedFields.success) {
+    return {
+      errors: validatedFields.error.flatten().fieldErrors,
+      message: 'Missing or invalid fields. Failed to update the customer.',
+    };
+  }
+
+  const { name, email } = validatedFields.data;
+  try {
+    const updated = await sql`
+      UPDATE customers SET name = ${name}, email = ${email} WHERE id = ${id}
+    `;
+    if (updated.count === 0) return { message: 'That customer does not exist.' };
+  } catch (error) {
+    console.error('Database Error:', error);
+    return { message: 'Database Error: Failed to update the customer.' };
+  }
+
+  revalidateCustomers();
+  redirect('/dashboard/customers');
+}
+
+/** A delete the invoices' foreign key refused (PostgreSQL foreign_key_violation). */
+const hasInvoices = (error: unknown) =>
+  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23503';
+
+export async function deleteCustomer(id: string, prevState: CustomerState): Promise<CustomerState> {
+  if (!(await isSignedIn())) {
+    return { message: 'You must be logged in to delete a customer.' };
+  }
+  if (!CustomerId.safeParse(id).success) {
+    return { message: 'That customer does not exist.' };
+  }
+
+  try {
+    await sql`DELETE FROM customers WHERE id = ${id}`;
+  } catch (error) {
+    if (hasInvoices(error)) {
+      return {
+        message: 'This customer still has invoices. Delete or reassign them first.',
+      };
+    }
+    console.error('Database Error:', error);
+    return { message: 'Database Error: Failed to delete the customer.' };
+  }
+
+  revalidateCustomers();
+  return { message: null };
+}
+
 export async function authenticate(prevState: string | undefined, formData: FormData) {
   try {
     await signIn('credentials', formData);
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 1db99a8..526c088 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -1,6 +1,7 @@
 import postgres from 'postgres';
 import {
   CardStat,
+  CustomerEdit,
   CustomerField,
   CustomersTableType,
   InvoiceForm,
@@ -225,6 +226,19 @@ export async function fetchCustomers() {
   }
 }
 
+/** A customer for the edit form, or undefined if there is none with that id. */
+export async function fetchCustomerById(id: string) {
+  try {
+    const data = await sql<CustomerEdit[]>`
+      SELECT id, name, email FROM customers WHERE id = ${id}
+    `;
+    return data[0];
+  } catch (error) {
+    console.error('Database Error:', error);
+    throw new Error('Failed to fetch customer.');
+  }
+}
+
 export async function fetchFilteredCustomers(query: string) {
   try {
     const data = await sql<CustomersTableType[]>`
diff --git a/app/lib/definitions.ts b/app/lib/definitions.ts
index 415a674..a784c24 100644
--- a/app/lib/definitions.ts
+++ b/app/lib/definitions.ts
@@ -85,6 +85,13 @@ export type FormattedCustomersTable = {
   total_paid: string;
 };
 
+/** A customer as the edit form shows it. */
+export type CustomerEdit = {
+  id: string;
+  name: string;
+  email: string;
+};
+
 export type CustomerField = {
   id: string;
   name: string;
diff --git a/app/lib/schemas.ts b/app/lib/schemas.ts
index cc4e6f5..7c11915 100644
--- a/app/lib/schemas.ts
+++ b/app/lib/schemas.ts
@@ -17,3 +17,20 @@ export const FormSchema = z.object({
 export const CreateInvoice = FormSchema.omit({ id: true, date: true });
 
 export const UpdateInvoice = FormSchema.omit({ id: true, date: true });
+
+/** A customer as the create and edit forms send it. */
+export const CustomerForm = z.object({
+  name: z
+    .string({ invalid_type_error: 'Please enter a name.' })
+    .trim()
+    .min(1, { message: 'Please enter a name.' })
+    .max(255, { message: 'A name can be at most 255 characters.' }),
+  email: z
+    .string({ invalid_type_error: 'Please enter an email address.' })
+    .trim()
+    .max(255, { message: 'An email address can be at most 255 characters.' })
+    .email({ message: 'Please enter a valid email address.' }),
+});
+
+/** A customer id from a URL or a form: anything but a UUID names no customer. */
+export const CustomerId = z.string().uuid();
diff --git a/app/ui/customers/buttons.tsx b/app/ui/customers/buttons.tsx
new file mode 100644
index 0000000..1bd8cdd
--- /dev/null
+++ b/app/ui/customers/buttons.tsx
@@ -0,0 +1,61 @@
+'use client';
+
+import Link from 'next/link';
+import { useActionState, useId } from 'react';
+import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
+import { type CustomerState, deleteCustomer } from '@/app/lib/actions';
+
+export function CreateCustomer() {
+  return (
+    <Link
+      href="/dashboard/customers/create"
+      className="flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
+    >
+      <span className="hidden md:block">Create Customer</span> <PlusIcon className="h-5 md:ml-4" />
+    </Link>
+  );
+}
+
+export function UpdateCustomer({ id, name }: { id: string; name: string }) {
+  return (
+    <Link
+      href={`/dashboard/customers/${id}/edit`}
+      className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-aura hover:text-white"
+    >
+      <span className="sr-only">Edit {name}</span>
+      <PencilIcon className="w-5" />
+    </Link>
+  );
+}
+
+/**
+ * Deletes the customer; the database refuses while they still have invoices, and
+ * the reason shows next to the button.
+ */
+export function DeleteCustomer({ id, name }: { id: string; name: string }) {
+  const initialState: CustomerState = { message: null };
+  const [state, formAction, pending] = useActionState(deleteCustomer.bind(null, id), initialState);
+  // The button is drawn twice (the phone list and the desktop table): a unique id each.
+  const errorId = useId();
+
+  return (
+    <form action={formAction} className="flex flex-col items-end">
+      <button
+        type="submit"
+        disabled={pending}
+        aria-describedby={errorId}
+        className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50"
+      >
+        <span className="sr-only">Delete {name}</span>
+        <TrashIcon className="w-5" />
+      </button>
+      <p
+        id={errorId}
+        aria-live="polite"
+        className="mt-1 max-w-48 whitespace-normal text-right text-xs text-red-400"
+      >
+        {state.message}
+      </p>
+    </form>
+  );
+}
diff --git a/app/ui/customers/customer-form.tsx b/app/ui/customers/customer-form.tsx
new file mode 100644
index 0000000..472a3e3
--- /dev/null
+++ b/app/ui/customers/customer-form.tsx
@@ -0,0 +1,86 @@
+'use client';
+
+import Link from 'next/link';
+import { useActionState } from 'react';
+import { AtSymbolIcon, UserCircleIcon } from '@heroicons/react/24/solid';
+import { type CustomerState, createCustomer, updateCustomer } from '@/app/lib/actions';
+import type { CustomerEdit } from '@/app/lib/definitions';
+import { Button } from '@/app/ui/button';
+
+/** Creates a customer, or edits `customer` when given one. */
+export default function CustomerForm({ customer }: { customer?: CustomerEdit }) {
+  const initialState: CustomerState = { message: null, errors: {} };
+  const action = customer ? updateCustomer.bind(null, customer.id) : createCustomer;
+  const [state, formAction] = useActionState(action, initialState);
+
+  return (
+    <form action={formAction}>
+      <div className="rounded-2xl border border-line bg-panel p-4 md:p-6">
+        <div className="mb-4">
+          <label htmlFor="name" className="mb-2 block text-sm font-medium text-white">
+            Name
+          </label>
+          <div className="relative">
+            <input
+              id="name"
+              name="name"
+              type="text"
+              defaultValue={customer?.name}
+              placeholder="The customer's name"
+              autoComplete="off"
+              className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white placeholder:text-aura/60 focus:border-aura focus:ring-aura"
+              aria-describedby="name-error"
+            />
+            <UserCircleIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
+          </div>
+          <div id="name-error" aria-live="polite" aria-atomic="true">
+            {state.errors?.name?.map((error: string) => (
+              <p className="mt-2 text-sm text-red-400" key={error}>
+                {error}
+              </p>
+            ))}
+          </div>
+        </div>
+
+        <div>
+          <label htmlFor="email" className="mb-2 block text-sm font-medium text-white">
+            Email
+          </label>
+          <div className="relative">
+            <input
+              id="email"
+              name="email"
+              type="email"
+              defaultValue={customer?.email}
+              placeholder="name@example.com"
+              autoComplete="off"
+              className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white placeholder:text-aura/60 focus:border-aura focus:ring-aura"
+              aria-describedby="email-error"
+            />
+            <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
+          </div>
+          <div id="email-error" aria-live="polite" aria-atomic="true">
+            {state.errors?.email?.map((error: string) => (
+              <p className="mt-2 text-sm text-red-400" key={error}>
+                {error}
+              </p>
+            ))}
+          </div>
+        </div>
+
+        <div aria-live="polite" aria-atomic="true">
+          {state.message && <p className="mt-4 text-sm text-red-400">{state.message}</p>}
+        </div>
+      </div>
+      <div className="mt-6 flex justify-end gap-4">
+        <Link
+          href="/dashboard/customers"
+          className="flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-aura transition-colors hover:bg-panel hover:text-white"
+        >
+          Cancel
+        </Link>
+        <Button type="submit">{customer ? 'Save Customer' : 'Create Customer'}</Button>
+      </div>
+    </form>
+  );
+}
diff --git a/app/ui/customers/table.tsx b/app/ui/customers/table.tsx
index 248c080..3d45b27 100644
--- a/app/ui/customers/table.tsx
+++ b/app/ui/customers/table.tsx
@@ -1,99 +1,103 @@
 import CustomerAvatar from '@/app/ui/customer-avatar';
-import Search from '@/app/ui/search';
-import { CustomersTableType, FormattedCustomersTable } from '@/app/lib/definitions';
+import { DeleteCustomer, UpdateCustomer } from '@/app/ui/customers/buttons';
+import { FormattedCustomersTable } from '@/app/lib/definitions';
 
-export default async function CustomersTable({
-  customers,
-}: {
-  customers: FormattedCustomersTable[];
-}) {
+export default function CustomersTable({ customers }: { customers: FormattedCustomersTable[] }) {
   return (
-    <div className="w-full">
-      <h1 className="mb-8 font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
-        Customers
-      </h1>
-      <Search placeholder="Search customers..." />
-      <div className="mt-6 flow-root">
-        <div className="overflow-x-auto">
-          <div className="inline-block min-w-full align-middle">
-            <div className="overflow-hidden rounded-2xl border border-line bg-panel p-2 md:pt-0">
-              <div className="md:hidden">
-                {customers?.map((customer) => (
-                  <div key={customer.id} className="mb-2 w-full rounded-xl bg-void/60 p-4">
-                    <div className="flex items-center justify-between border-b border-line pb-4">
-                      <div>
-                        <div className="mb-2 flex items-center">
-                          <div className="flex items-center gap-3">
-                            <CustomerAvatar name={customer.name} />
-                            <p>{customer.name}</p>
-                          </div>
-                        </div>
-                        <p className="text-sm text-aura">{customer.email}</p>
+    <div className="mt-6 flow-root">
+      <div className="overflow-x-auto">
+        <div className="inline-block min-w-full align-middle">
+          <div className="overflow-hidden rounded-2xl border border-line bg-panel p-2 md:pt-0">
+            <div className="md:hidden">
+              {customers.map((customer) => (
+                <div key={customer.id} className="mb-2 w-full rounded-xl bg-void/60 p-4">
+                  <div className="flex items-center justify-between border-b border-line pb-4">
+                    <div>
+                      <div className="mb-2 flex items-center gap-3">
+                        <CustomerAvatar name={customer.name} />
+                        <p>{customer.name}</p>
                       </div>
+                      <p className="text-sm text-aura">{customer.email}</p>
                     </div>
-                    <div className="flex w-full items-center justify-between border-b border-line py-5">
-                      <div className="flex w-1/2 flex-col">
-                        <p className="text-xs text-aura">Pending</p>
-                        <p className="font-medium">{customer.total_pending}</p>
-                      </div>
-                      <div className="flex w-1/2 flex-col">
-                        <p className="text-xs text-aura">Paid</p>
-                        <p className="font-medium">{customer.total_paid}</p>
-                      </div>
+                  </div>
+                  <div className="flex w-full items-center justify-between border-b border-line py-5">
+                    <div className="flex w-1/2 flex-col">
+                      <p className="text-xs text-aura">Pending</p>
+                      <p className="font-medium">{customer.total_pending}</p>
                     </div>
-                    <div className="pt-4 text-sm">
-                      <p>{customer.total_invoices} invoices</p>
+                    <div className="flex w-1/2 flex-col">
+                      <p className="text-xs text-aura">Paid</p>
+                      <p className="font-medium">{customer.total_paid}</p>
                     </div>
                   </div>
-                ))}
-              </div>
-              <table className="hidden min-w-full rounded-md text-white md:table">
-                <thead className="rounded-md text-left text-sm font-normal text-aura">
-                  <tr>
-                    <th scope="col" className="px-4 py-5 font-medium sm:pl-6">
-                      Name
-                    </th>
-                    <th scope="col" className="px-3 py-5 font-medium">
-                      Email
-                    </th>
-                    <th scope="col" className="px-3 py-5 font-medium">
-                      Total Invoices
-                    </th>
-                    <th scope="col" className="px-3 py-5 font-medium">
-                      Total Pending
-                    </th>
-                    <th scope="col" className="px-4 py-5 font-medium">
-                      Total Paid
-                    </th>
-                  </tr>
-                </thead>
-
-                <tbody className="divide-y divide-line text-white">
-                  {customers.map((customer) => (
-                    <tr key={customer.id} className="group">
-                      <td className="whitespace-nowrap bg-void/60 py-5 pl-4 pr-3 text-sm text-white group-first-of-type:rounded-md group-last-of-type:rounded-md sm:pl-6">
-                        <div className="flex items-center gap-3">
-                          <CustomerAvatar name={customer.name} />
-                          <p>{customer.name}</p>
-                        </div>
-                      </td>
-                      <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm">
-                        {customer.email}
-                      </td>
-                      <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm">
-                        {customer.total_invoices}
-                      </td>
-                      <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm">
-                        {customer.total_pending}
-                      </td>
-                      <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm group-first-of-type:rounded-md group-last-of-type:rounded-md">
-                        {customer.total_paid}
-                      </td>
-                    </tr>
-                  ))}
-                </tbody>
-              </table>
+                  <div className="flex items-start justify-between pt-4 text-sm">
+                    <p>{customer.total_invoices} invoices</p>
+                    <div className="flex items-start gap-2">
+                      <UpdateCustomer id={customer.id} name={customer.name} />
+                      <DeleteCustomer id={customer.id} name={customer.name} />
+                    </div>
+                  </div>
+                </div>
+              ))}
             </div>
+            <table className="hidden min-w-full rounded-md text-white md:table">
+              <thead className="rounded-md text-left text-sm font-normal text-aura">
+                <tr>
+                  <th scope="col" className="px-4 py-5 font-medium sm:pl-6">
+                    Name
+                  </th>
+                  <th scope="col" className="px-3 py-5 font-medium">
+                    Email
+                  </th>
+                  <th scope="col" className="px-3 py-5 font-medium">
+                    Total Invoices
+                  </th>
+                  <th scope="col" className="px-3 py-5 font-medium">
+                    Total Pending
+                  </th>
+                  <th scope="col" className="px-3 py-5 font-medium">
+                    Total Paid
+                  </th>
+                  <th scope="col" className="relative py-3 pl-6 pr-3">
+                    <span className="sr-only">Edit or delete</span>
+                  </th>
+                </tr>
+              </thead>
+
+              <tbody className="divide-y divide-line text-white">
+                {customers.map((customer) => (
+                  <tr key={customer.id} className="group">
+                    <td className="whitespace-nowrap bg-void/60 py-5 pl-4 pr-3 text-sm text-white sm:pl-6">
+                      <div className="flex items-center gap-3">
+                        <CustomerAvatar name={customer.name} />
+                        <p>{customer.name}</p>
+                      </div>
+                    </td>
+                    <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm">
+                      {customer.email}
+                    </td>
+                    <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm">
+                      {customer.total_invoices}
+                    </td>
+                    <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm">
+                      {customer.total_pending}
+                    </td>
+                    <td className="whitespace-nowrap bg-void/60 px-4 py-5 text-sm">
+                      {customer.total_paid}
+                    </td>
+                    <td className="bg-void/60 py-3 pl-6 pr-3">
+                      <div className="flex items-start justify-end gap-3">
+                        <UpdateCustomer id={customer.id} name={customer.name} />
+                        <DeleteCustomer id={customer.id} name={customer.name} />
+                      </div>
+                    </td>
+                  </tr>
+                ))}
+              </tbody>
+            </table>
+            {customers.length === 0 && (
+              <p className="px-4 py-8 text-center text-sm text-aura">No customers found.</p>
+            )}
           </div>
         </div>
       </div>
diff --git a/tests/e2e/customers.spec.ts b/tests/e2e/customers.spec.ts
new file mode 100644
index 0000000..7e86749
--- /dev/null
+++ b/tests/e2e/customers.spec.ts
@@ -0,0 +1,109 @@
+import { type Page, expect, test } from '@playwright/test';
+
+// Customer create, edit and delete, logged in as the demo user, against the test
+// schema global-setup.ts rebuilds. Each test makes its own customer and asserts
+// only on it, since the tests run in parallel on one schema.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+async function logIn(page: Page) {
+  await page.goto('/login');
+  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Password', { exact: true }).fill('123456');
+  await page.getByRole('button', { name: /log in/i }).click();
+  await expect(page).toHaveURL(/\/dashboard$/);
+}
+
+// After a submit, allow for the redirect's page still compiling under next dev.
+
+/** A customer name no other test (or run) uses. */
+const unique = (what: string) =>
+  `${what} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
+
+async function createCustomer(page: Page, name: string, email: string) {
+  await page.goto('/dashboard/customers/create');
+  await page.getByLabel('Name').fill(name);
+  await page.getByLabel('Email').fill(email);
+  await page.getByRole('button', { name: 'Create Customer' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
+}
+
+/** The customer list, searched down to `name`. */
+async function findCustomer(page: Page, name: string) {
+  await page.goto(`/dashboard/customers?query=${encodeURIComponent(name)}`);
+  return page.getByRole('row').filter({ hasText: name });
+}
+
+test('a customer is created, edited and deleted', async ({ page }) => {
+  await logIn(page);
+  const name = unique('Orbital Snacks');
+  const email = `${name.split(' ').pop()}@example.com`;
+  await createCustomer(page, name, email);
+
+  let row = await findCustomer(page, name);
+  await expect(row).toHaveCount(1);
+  await expect(row).toContainText(email);
+
+  // Edit: the form shows the current values; the list shows the new ones.
+  await row.getByRole('link', { name: `Edit ${name}` }).click();
+  await expect(page.getByLabel('Name')).toHaveValue(name);
+  await expect(page.getByLabel('Email')).toHaveValue(email);
+  const renamed = `${name} Ltd`;
+  await page.getByLabel('Name').fill(renamed);
+  await page.getByRole('button', { name: 'Save Customer' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
+  row = await findCustomer(page, renamed);
+  await expect(row).toHaveCount(1);
+
+  // Delete: a customer without invoices goes.
+  await row.getByRole('button', { name: `Delete ${renamed}` }).click();
+  await expect(page.getByRole('row').filter({ hasText: renamed })).toHaveCount(0);
+});
+
+test('the form says what is missing or wrong, next to each field', async ({ page }) => {
+  await logIn(page);
+  await page.goto('/dashboard/customers/create');
+  // The browser's own check (type=email) lets this through; the server's does not.
+  await page.getByLabel('Email').fill('zorg@nowhere');
+  await page.getByRole('button', { name: 'Create Customer' }).click();
+  await expect(page.locator('#name-error')).toHaveText('Please enter a name.');
+  await expect(page.locator('#email-error')).toHaveText('Please enter a valid email address.');
+  await expect(page.getByLabel('Name')).toHaveAttribute('aria-describedby', 'name-error');
+  await expect(page.getByLabel('Email')).toHaveAttribute('aria-describedby', 'email-error');
+  await expect(page).toHaveURL(/\/dashboard\/customers\/create$/);
+});
+
+test('a customer who still has invoices cannot be deleted, and the list says why', async ({
+  page,
+}) => {
+  await logIn(page);
+  const name = unique('Nebula Freight');
+  await createCustomer(page, name, `${name.split(' ').pop()}@example.com`);
+
+  // Give them an invoice.
+  await page.goto('/dashboard/invoices/create');
+  await page.getByLabel('Choose customer').selectOption({ label: name });
+  await page.getByLabel('Choose an amount').fill('42');
+  await page.getByLabel('Pending').check();
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+
+  const row = await findCustomer(page, name);
+  const remove = row.getByRole('button', { name: `Delete ${name}` });
+  await remove.click();
+  await expect(row).toContainText(
+    'This customer still has invoices. Delete or reassign them first.'
+  );
+  // The message describes the button for assistive technology, and the customer stays.
+  const describedBy = await remove.getAttribute('aria-describedby');
+  await expect(page.locator(`[id="${describedBy}"]`)).toContainText('still has invoices');
+  await page.reload();
+  await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(1);
+});
+
+test('editing a customer that does not exist shows not found', async ({ page }) => {
+  await logIn(page);
+  await page.goto('/dashboard/customers/00000000-0000-4000-8000-000000000000/edit');
+  await expect(page.getByText('Could not find the requested customer.')).toBeVisible();
+  await page.goto('/dashboard/customers/not-a-uuid/edit');
+  await expect(page.getByText('Could not find the requested customer.')).toBeVisible();
+});
diff --git a/tests/e2e/dashboard.spec.ts b/tests/e2e/dashboard.spec.ts
index c4ce8db..a51f048 100644
--- a/tests/e2e/dashboard.spec.ts
+++ b/tests/e2e/dashboard.spec.ts
@@ -13,7 +13,8 @@ test('the demo user logs in and the dashboard shows the seeded data', async ({ p
   await expect(page).toHaveURL(/\/dashboard$/);
   await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
 
-  await page.goto('/dashboard/invoices');
+  // Searched, so invoices other tests add (they sort first, by date) cannot push it off page 1.
+  await page.goto('/dashboard/invoices?query=Evil%20Rabbit');
   await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible();
   // The desktop table; the same rows also render in a list that is hidden at this width.
   await expect(page.getByRole('cell', { name: 'Evil Rabbit' }).first()).toBeVisible();
diff --git a/tests/unit/schemas.test.ts b/tests/unit/schemas.test.ts
index e8918a7..eea7d85 100644
--- a/tests/unit/schemas.test.ts
+++ b/tests/unit/schemas.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { CreateInvoice, UpdateInvoice } from '@/app/lib/schemas';
+import { CreateInvoice, CustomerForm, CustomerId, UpdateInvoice } from '@/app/lib/schemas';
 
 // The actions pass formData.get(...) straight in, so a missing field arrives as null.
 const valid = { customerId: 'c0ffee', amount: '12.50', status: 'paid' };
@@ -50,3 +50,50 @@ describe.each([
     expect(result.data).not.toHaveProperty('date');
   });
 });
+
+describe('CustomerForm', () => {
+  const valid = { name: 'Zorg Industries', email: 'zorg@example.com' };
+
+  it('accepts a name and an email address, trimmed', () => {
+    expect(CustomerForm.parse({ name: '  Zorg  ', email: ' zorg@example.com ' })).toEqual({
+      name: 'Zorg',
+      email: 'zorg@example.com',
+    });
+  });
+
+  it('needs a name', () => {
+    for (const name of [null, '', '   ']) {
+      const result = CustomerForm.safeParse({ ...valid, name });
+      expect(result.error?.flatten().fieldErrors.name).toEqual(['Please enter a name.']);
+    }
+  });
+
+  it('needs a valid email address', () => {
+    for (const email of ['', 'not-an-email', 'a@', null]) {
+      const result = CustomerForm.safeParse({ ...valid, email });
+      expect(result.success).toBe(false);
+      expect(result.error?.flatten().fieldErrors.email?.length).toBeGreaterThan(0);
+    }
+  });
+
+  it('refuses a name or email longer than the database allows (255)', () => {
+    expect(CustomerForm.safeParse({ ...valid, name: 'x'.repeat(256) }).success).toBe(false);
+    expect(
+      CustomerForm.safeParse({ ...valid, email: `${'x'.repeat(250)}@example.com` }).success
+    ).toBe(false);
+  });
+
+  it('ignores anything else the client sends', () => {
+    const result = CustomerForm.safeParse({ ...valid, id: 'x', image_url: 'evil' });
+    expect(result.data).toEqual(valid);
+  });
+});
+
+describe('CustomerId', () => {
+  it('is a UUID, or nothing', () => {
+    expect(CustomerId.safeParse('3958dc9e-712f-4377-85e9-fec4b6a6442a').success).toBe(true);
+    for (const id of ['', '1', "' OR 1=1 --", '3958dc9e-712f-4377-85e9']) {
+      expect(CustomerId.safeParse(id).success).toBe(false);
+    }
+  });
+});
~~~~

</details>

#### TC2 — `night-2026-10-01-c2-checkpoint`

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

<details><summary>Code:  5 files changed, 235 insertions(+), 13 deletions(-)</summary>

~~~~diff
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index fdd9411..5e12891 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -217,14 +217,22 @@ export async function deleteCustomer(id: string, prevState: CustomerState): Prom
     return { message: 'That customer does not exist.' };
   }
 
+  const stillInvoiced = {
+    message: 'This customer still has invoices. Delete or reassign them first.',
+  };
   try {
-    await sql`DELETE FROM customers WHERE id = ${id}`;
-  } catch (error) {
-    if (hasInvoices(error)) {
-      return {
-        message: 'This customer still has invoices. Delete or reassign them first.',
-      };
+    // Refuses a customer with invoices itself, so it holds even on a database the
+    // foreign key (migration 0002) has not reached yet; the key covers the race.
+    const deleted = await sql`
+      DELETE FROM customers
+      WHERE id = ${id} AND NOT EXISTS (SELECT 1 FROM invoices WHERE customer_id = ${id})
+    `;
+    if (deleted.count === 0) {
+      const [exists] = await sql`SELECT 1 FROM customers WHERE id = ${id}`;
+      return exists ? stillInvoiced : { message: 'That customer does not exist.' };
     }
+  } catch (error) {
+    if (hasInvoices(error)) return stillInvoiced;
     console.error('Database Error:', error);
     return { message: 'Database Error: Failed to delete the customer.' };
   }
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index 399cd49..d712e1f 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -112,15 +112,36 @@ export function XenocatCatsProvider({
     // whatever is under the cat, as always (the cats never take clicks).
     // A mouse click lands where the visible cursor is; a tap or a pen, where it
     // touched. Not while an effect blocks clicks.
+    // A press that pokes a cat is the cat's: the rest of it (up to and including
+    // its click) never reaches what lies beneath — a hidden Delete button, say.
+    // Keyboard-made clicks (detail 0) never come through here.
+    let swallowPress = false;
     const onPoke = (event: PointerEvent) => {
+      swallowPress = false;
       if (cursor.isBusy()) return;
       const touched = { x: event.clientX, y: event.clientY };
       const at = event.pointerType === 'mouse' ? (cursor.position() ?? touched) : touched;
       if (engine.poke(at, cursor.now())) {
         setCats(snapshot(engine));
+        swallowPress = true;
+        event.preventDefault();
+        event.stopPropagation();
       }
     };
+    const onPressRest = (event: Event) => {
+      if (!swallowPress) return;
+      if (event.type === 'click' && (event as MouseEvent).detail === 0) return;
+      event.preventDefault();
+      event.stopPropagation();
+      if (event.type === 'click' || event.type === 'contextmenu') swallowPress = false;
+    };
+    const endPress = () => {
+      swallowPress = false;
+    };
+    const pressRest = ['pointerup', 'mousedown', 'mouseup', 'click', 'contextmenu'] as const;
     window.addEventListener('pointerdown', onPoke, { capture: true });
+    for (const type of pressRest) window.addEventListener(type, onPressRest, { capture: true });
+    window.addEventListener('pointercancel', endPress, { capture: true });
 
     // A cat's sounds follow its phases: arriving, then waking up.
     const phases = new Map<number, CatPhase>();
@@ -191,6 +212,9 @@ export function XenocatCatsProvider({
       window.removeEventListener('resize', onResize);
       for (const type of gestures) window.removeEventListener(type, unlock, { capture: true });
       window.removeEventListener('pointerdown', onPoke, { capture: true });
+      for (const type of pressRest)
+        window.removeEventListener(type, onPressRest, { capture: true });
+      window.removeEventListener('pointercancel', endPress, { capture: true });
     };
   }, [engine, cursor, player]);
 
diff --git a/tests/e2e/pet-cat.spec.ts b/tests/e2e/pet-cat.spec.ts
index 1130b68..13a9560 100644
--- a/tests/e2e/pet-cat.spec.ts
+++ b/tests/e2e/pet-cat.spec.ts
@@ -52,9 +52,7 @@ const tones = (page: Page) => page.evaluate(() => (window as unknown as { tones:
 /** Summons Void Tabby asleep and puts the pointer on it. Returns the cat. */
 async function sleepingCatUnderPointer(page: Page) {
   await page.getByTestId('summon-asleep-void-tabby').click();
-  // The first one: a click on it can pass through to a Summon button beneath and
-  // bring a second cat (the cats never take clicks).
-  const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]').first();
+  const cat = page.locator('[data-testid="xenocat"][data-cat-type="void-tabby"]');
   await expect(cat).toHaveAttribute('data-phase', 'sleeping');
   const box = (await cat.boundingBox())!;
   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
@@ -82,15 +80,17 @@ test('clicking a sleeping cat wakes it at once, angry, and its attack lasts long
   await page.mouse.click(centre.x, centre.y);
   await expect(cat).toHaveAttribute('data-angry', 'true');
   await expect(cat).not.toHaveAttribute('data-phase', 'sleeping');
+  // The click was the cat's: nothing beneath it (a Summon button, say) got it.
+  await page.waitForTimeout(300);
+  await expect(page.getByTestId('xenocat')).toHaveCount(1);
   // Void Tabby's vanish lasts 3 s; angry, 1.5 times that.
   const fake = page.getByTestId('fake-cursor');
   await expect(fake).toHaveAttribute('data-effect', 'vanish', { timeout: 5000 });
   // At least 3.4 s after it began (it began before it was seen), it is still on.
   await page.waitForTimeout(vanish.durationMs + 400);
   await expect(fake).toHaveAttribute('data-effect', 'vanish');
-  // …and ends within 4.5 s. (The click also reached whatever was under the cat,
-  // which may have summoned another cat whose attack follows.)
-  await expect(fake).not.toHaveAttribute('data-effect', 'vanish', {
+  // …and ends within 4.5 s.
+  await expect(fake).toHaveAttribute('data-effect', '', {
     timeout: vanish.durationMs * CAT_CONFIG.angryFactor,
   });
 });
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index 5ed6333..753e53e 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -15,7 +15,14 @@ vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
 vi.mock('next/cache', () => ({ revalidatePath }));
 vi.mock('next/navigation', () => ({ redirect }));
 
-const { createInvoice, updateInvoice, deleteInvoice } = await import('@/app/lib/actions');
+const {
+  createInvoice,
+  updateInvoice,
+  deleteInvoice,
+  createCustomer,
+  updateCustomer,
+  deleteCustomer,
+} = await import('@/app/lib/actions');
 
 function invoiceForm(fields: Record<string, string> = {}) {
   const form = new FormData();
@@ -106,3 +113,112 @@ describe('with a session', () => {
     consoleError.mockRestore();
   });
 });
+
+describe('customer actions', () => {
+  const id = '3958dc9e-712f-4377-85e9-fec4b6a6442a';
+  const customerForm = (fields: Record<string, string> = {}) => {
+    const form = new FormData();
+    const values = { name: ' Orbital Snacks ', email: ' orbit@example.com ', ...fields };
+    for (const [key, value] of Object.entries(values)) form.set(key, value);
+    return form;
+  };
+
+  describe('without a session', () => {
+    beforeEach(() => auth.mockResolvedValue(null));
+
+    it('all three refuse, write nothing, and reveal nothing about the input', async () => {
+      expect(await createCustomer({}, customerForm({ email: 'bad' }))).toEqual({
+        message: 'You must be logged in to create a customer.',
+      });
+      expect(await updateCustomer(id, {}, customerForm())).toEqual({
+        message: 'You must be logged in to update a customer.',
+      });
+      expect(await deleteCustomer('not-a-uuid', {})).toEqual({
+        message: 'You must be logged in to delete a customer.',
+      });
+      expect(sql).not.toHaveBeenCalled();
+      expect(redirect).not.toHaveBeenCalled();
+      expect(revalidatePath).not.toHaveBeenCalled();
+    });
+  });
+
+  describe('with a session', () => {
+    beforeEach(() => auth.mockResolvedValue(signedIn));
+
+    it('createCustomer stores the trimmed values and refreshes everything that shows customers', async () => {
+      await createCustomer({}, customerForm());
+      expect(sql).toHaveBeenCalledTimes(1);
+      expect(sql.mock.calls[0].slice(1, 3)).toEqual(['Orbital Snacks', 'orbit@example.com']);
+      for (const path of [
+        '/dashboard/customers',
+        '/dashboard/invoices',
+        '/dashboard/invoices/create',
+      ]) {
+        expect(revalidatePath).toHaveBeenCalledWith(path);
+      }
+      expect(redirect).toHaveBeenCalledWith('/dashboard/customers');
+    });
+
+    it('createCustomer validates and writes nothing on bad input', async () => {
+      const result = await createCustomer({}, customerForm({ name: '  ', email: 'nope' }));
+      expect(result.errors).toEqual({
+        name: ['Please enter a name.'],
+        email: ['Please enter a valid email address.'],
+      });
+      expect(sql).not.toHaveBeenCalled();
+    });
+
+    it('a malformed id never reaches the database', async () => {
+      for (const bad of ['', '1', "' OR 1=1 --"]) {
+        expect(await updateCustomer(bad, {}, customerForm())).toEqual({
+          message: 'That customer does not exist.',
+        });
+        expect(await deleteCustomer(bad, {})).toEqual({ message: 'That customer does not exist.' });
+      }
+      expect(sql).not.toHaveBeenCalled();
+    });
+
+    it('updateCustomer says so when the customer is gone, without redirecting', async () => {
+      sql.mockResolvedValue(Object.assign([], { count: 0 }));
+      expect(await updateCustomer(id, {}, customerForm())).toEqual({
+        message: 'That customer does not exist.',
+      });
+      expect(redirect).not.toHaveBeenCalled();
+    });
+
+    it('deleteCustomer reports a customer who still has invoices', async () => {
+      sql.mockRejectedValue(Object.assign(new Error('fk'), { code: '23503' }));
+      expect(await deleteCustomer(id, {})).toEqual({
+        message: 'This customer still has invoices. Delete or reassign them first.',
+      });
+      expect(revalidatePath).not.toHaveBeenCalled();
+    });
+
+    it('any other database error is generic, and logged on the server only', async () => {
+      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
+      sql.mockRejectedValue(Object.assign(new Error('secret detail'), { code: '57P01' }));
+      const result = await deleteCustomer(id, {});
+      expect(result).toEqual({ message: 'Database Error: Failed to delete the customer.' });
+      expect(JSON.stringify(result)).not.toContain('secret');
+      expect(log).toHaveBeenCalled();
+      log.mockRestore();
+    });
+
+    it('deleteCustomer refuses a customer with invoices itself, before any key', async () => {
+      // The delete matches nothing because invoices exist; the customer does.
+      sql.mockResolvedValueOnce(Object.assign([], { count: 0 })).mockResolvedValueOnce([{}]);
+      expect(await deleteCustomer(id, {})).toEqual({
+        message: 'This customer still has invoices. Delete or reassign them first.',
+      });
+      // …and tells a customer that is gone apart.
+      sql.mockResolvedValueOnce(Object.assign([], { count: 0 })).mockResolvedValueOnce([]);
+      expect(await deleteCustomer(id, {})).toEqual({ message: 'That customer does not exist.' });
+      expect(revalidatePath).not.toHaveBeenCalled();
+    });
+
+    it('a successful delete refreshes the lists', async () => {
+      expect(await deleteCustomer(id, {})).toEqual({ message: null });
+      expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices/create');
+    });
+  });
+});
diff --git a/tests/unit/xenocats/cat-layer.test.tsx b/tests/unit/xenocats/cat-layer.test.tsx
index 3aaaee2..d03b8d2 100644
--- a/tests/unit/xenocats/cat-layer.test.tsx
+++ b/tests/unit/xenocats/cat-layer.test.tsx
@@ -200,3 +200,77 @@ describe('XenocatCatsProvider', () => {
     }
   });
 });
+
+describe('a combo on the page', () => {
+  it('two cats waking together attack the cursor once, with the combo effect', async () => {
+    render(
+      <XenocatCursorProvider now={() => clock} seed={7}>
+        {/* Wide enough to pair wherever they land; a short nap so they wake together. */}
+        <XenocatCatsProvider
+          autoSpawn={false}
+          config={{ comboDistance: 5000, sleepMs: [100, 101] }}
+        >
+          <Capture />
+        </XenocatCatsProvider>
+      </XenocatCursorProvider>
+    );
+    fireEvent.pointerMove(window, { clientX: 5, clientY: 5 });
+    act(() => {
+      // Freeze + Bounce: an ice puck.
+      expect(cats.summon('cryo-persian', { asleep: true })).toBe(true);
+      expect(cats.summon('pinball-devon', { asleep: true })).toBe(true);
+    });
+    clock = 1200; // both arrived (1000 and 1100 ms entrances): asleep
+    await frames();
+    clock = 1300; // both woke within 100 ms of each other: paired
+    await frames();
+    const cards = screen.getAllByTestId('xenocat');
+    expect(cards.map((c) => c.dataset.combo)).toEqual(['ice-puck', 'ice-puck']);
+    clock = 2300; // both awake: one attack, together
+    await frames();
+    expect(screen.getByTestId('fake-cursor').dataset.effect).toBe('ice-puck');
+    expect(phases()).toEqual(['attacking', 'attacking']);
+  });
+});
+
+describe('poking a sleeping cat', () => {
+  it('wakes it, and the rest of that press never reaches what lies beneath', async () => {
+    const onClick = vi.fn();
+    render(
+      <XenocatCursorProvider now={() => clock} seed={7}>
+        <XenocatCatsProvider autoSpawn={false}>
+          <Capture />
+          <button onClick={onClick}>Delete</button>
+        </XenocatCatsProvider>
+      </XenocatCursorProvider>
+    );
+    fireEvent.pointerMove(window, { clientX: 1, clientY: 1 });
+    act(() => {
+      cats.summon('void-tabby', { asleep: true });
+    });
+    clock = 1100; // arrived: asleep
+    await frames();
+    const cat = screen.getByTestId('xenocat');
+    expect(cat.dataset.phase).toBe('sleeping');
+    const at = {
+      clientX: parseFloat(cat.style.left) + 10,
+      clientY: parseFloat(cat.style.top) + 10,
+    };
+    fireEvent.pointerMove(window, at);
+    await frames();
+
+    const button = screen.getByText('Delete');
+    fireEvent.pointerDown(button, { ...at, pointerType: 'mouse' });
+    fireEvent.mouseDown(button, { ...at, detail: 1 });
+    fireEvent.click(button, { ...at, detail: 1 });
+    expect(onClick).not.toHaveBeenCalled();
+    await frames();
+    expect(cat.dataset.angry).toBe('true');
+
+    // The next press, not on a sleeping cat, goes through; so does the keyboard.
+    fireEvent.pointerDown(button, { clientX: 1, clientY: 1, pointerType: 'mouse' });
+    fireEvent.click(button, { clientX: 1, clientY: 1, detail: 1 });
+    fireEvent.click(button, { detail: 0 });
+    expect(onClick).toHaveBeenCalledTimes(2);
+  });
+});
~~~~

</details>

#### T11 — `night-2026-10-01-t11-status-filter`

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

<details><summary>Code:  8 files changed, 189 insertions(+), 13 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 302fff3..95c304e 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -104,11 +104,11 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard, customers)
+      - name: Browser tests against next start (smoke, branding, dashboard, customers, invoices)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers
+          tests/e2e/customers tests/e2e/invoices-filter
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -172,11 +172,11 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard, customers)
+      - name: Browser tests (smoke, branding, dashboard, customers, invoices)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers
+          tests/e2e/customers tests/e2e/invoices-filter
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/app/dashboard/invoices/page.tsx b/app/dashboard/invoices/page.tsx
index 5905b71..b1f5aca 100644
--- a/app/dashboard/invoices/page.tsx
+++ b/app/dashboard/invoices/page.tsx
@@ -6,6 +6,8 @@ import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
 import { Suspense } from 'react';
 import { fetchInvoicesPages } from '@/app/lib/data';
 import { Metadata } from 'next';
+import { parseStatusFilter } from '@/app/lib/schemas';
+import StatusFilter from '@/app/ui/invoices/status-filter';
 
 export const metadata: Metadata = {
   title: 'Invoices',
@@ -15,12 +17,15 @@ export default async function Page(props: {
   searchParams?: Promise<{
     query?: string;
     page?: string;
+    status?: string;
   }>;
 }) {
   const searchParams = await props.searchParams;
   const query = searchParams?.query || '';
   const currentPage = Number(searchParams?.page) || 1;
-  const totalPages = await fetchInvoicesPages(query);
+  // Anything but a known status shows them all.
+  const status = parseStatusFilter(searchParams?.status);
+  const totalPages = await fetchInvoicesPages(query, status);
 
   return (
     <div className="w-full">
@@ -31,10 +36,11 @@ export default async function Page(props: {
       </div>
       <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
         <Search placeholder="Search invoices..." />
+        <StatusFilter />
         <CreateInvoice />
       </div>
-      <Suspense key={query + currentPage} fallback={<InvoicesTableSkeleton />}>
-        <Table query={query} currentPage={currentPage} />
+      <Suspense key={`${query}|${currentPage}|${status}`} fallback={<InvoicesTableSkeleton />}>
+        <Table query={query} currentPage={currentPage} status={status} />
       </Suspense>
       <div className="mt-5 flex w-full justify-center">
         <Pagination totalPages={totalPages} />
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 526c088..cf1ecbf 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -9,6 +9,7 @@ import {
   LatestInvoiceRaw,
   MonthTotals,
 } from './definitions';
+import type { InvoiceStatusFilter } from './schemas';
 import { formatCurrency } from './utils';
 import { Range, lastTwelveMonths, monthStart, percentChange } from './dashboard';
 
@@ -129,7 +130,15 @@ export async function fetchMonthlyTotals(range: Range, now = new Date()): Promis
 }
 
 const ITEMS_PER_PAGE = 6;
-export async function fetchFilteredInvoices(query: string, currentPage: number) {
+/**
+ * A page of invoices matching the search `query` and, if given, the `status`.
+ * The search and the status combine (both must match).
+ */
+export async function fetchFilteredInvoices(
+  query: string,
+  currentPage: number,
+  status: InvoiceStatusFilter | null = null
+) {
   const offset = (currentPage - 1) * ITEMS_PER_PAGE;
 
   try {
@@ -144,12 +153,14 @@ export async function fetchFilteredInvoices(query: string, currentPage: number)
         customers.image_url
       FROM invoices
       JOIN customers ON invoices.customer_id = customers.id
-      WHERE
+      WHERE (
         customers.name ILIKE ${`%${query}%`} OR
         customers.email ILIKE ${`%${query}%`} OR
         invoices.amount::text ILIKE ${`%${query}%`} OR
         invoices.date::text ILIKE ${`%${query}%`} OR
         invoices.status ILIKE ${`%${query}%`}
+      )
+      AND (${status}::text IS NULL OR invoices.status = ${status})
       ORDER BY invoices.date DESC
       LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
     `;
@@ -161,17 +172,19 @@ export async function fetchFilteredInvoices(query: string, currentPage: number)
   }
 }
 
-export async function fetchInvoicesPages(query: string) {
+export async function fetchInvoicesPages(query: string, status: InvoiceStatusFilter | null = null) {
   try {
     const data = await sql`SELECT COUNT(*)
     FROM invoices
     JOIN customers ON invoices.customer_id = customers.id
-    WHERE
+    WHERE (
       customers.name ILIKE ${`%${query}%`} OR
       customers.email ILIKE ${`%${query}%`} OR
       invoices.amount::text ILIKE ${`%${query}%`} OR
       invoices.date::text ILIKE ${`%${query}%`} OR
       invoices.status ILIKE ${`%${query}%`}
+    )
+    AND (${status}::text IS NULL OR invoices.status = ${status})
   `;
 
     const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
diff --git a/app/lib/schemas.ts b/app/lib/schemas.ts
index 7c11915..4acef9d 100644
--- a/app/lib/schemas.ts
+++ b/app/lib/schemas.ts
@@ -34,3 +34,10 @@ export const CustomerForm = z.object({
 
 /** A customer id from a URL or a form: anything but a UUID names no customer. */
 export const CustomerId = z.string().uuid();
+
+/** The invoice list's status filter, from the URL: anything unknown shows every status. */
+export const InvoiceStatusFilter = z.enum(['paid', 'pending']);
+export type InvoiceStatusFilter = z.infer<typeof InvoiceStatusFilter>;
+
+export const parseStatusFilter = (value: string | undefined): InvoiceStatusFilter | null =>
+  InvoiceStatusFilter.safeParse(value).data ?? null;
diff --git a/app/ui/invoices/status-filter.tsx b/app/ui/invoices/status-filter.tsx
new file mode 100644
index 0000000..77189cb
--- /dev/null
+++ b/app/ui/invoices/status-filter.tsx
@@ -0,0 +1,42 @@
+'use client';
+
+import { FunnelIcon } from '@heroicons/react/20/solid';
+import { usePathname, useRouter, useSearchParams } from 'next/navigation';
+
+/**
+ * Filters the invoice list by status, in the URL (`?status=`) beside the search,
+ * like it: the search and the filter combine, and pagination keeps both.
+ */
+export default function StatusFilter() {
+  const searchParams = useSearchParams();
+  const pathname = usePathname();
+  const { replace } = useRouter();
+  const current = searchParams.get('status') ?? '';
+
+  const choose = (status: string) => {
+    const params = new URLSearchParams(searchParams);
+    params.set('page', '1');
+    if (status) params.set('status', status);
+    else params.delete('status');
+    replace(`${pathname}?${params.toString()}`);
+  };
+
+  return (
+    <div className="relative flex-none">
+      <label htmlFor="status-filter" className="sr-only">
+        Status
+      </label>
+      <select
+        id="status-filter"
+        value={['paid', 'pending'].includes(current) ? current : ''}
+        onChange={(event) => choose(event.target.value)}
+        className="block h-10 rounded-xl border border-line bg-panel py-2 pl-9 pr-8 text-sm text-white focus:border-aura focus:ring-aura"
+      >
+        <option value="">All statuses</option>
+        <option value="paid">Paid</option>
+        <option value="pending">Pending</option>
+      </select>
+      <FunnelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aura" />
+    </div>
+  );
+}
diff --git a/app/ui/invoices/table.tsx b/app/ui/invoices/table.tsx
index adf4eee..96ea027 100644
--- a/app/ui/invoices/table.tsx
+++ b/app/ui/invoices/table.tsx
@@ -3,15 +3,18 @@ import { UpdateInvoice, DeleteInvoice } from '@/app/ui/invoices/buttons';
 import InvoiceStatus from '@/app/ui/invoices/status';
 import { formatDateToLocal, formatCurrency } from '@/app/lib/utils';
 import { fetchFilteredInvoices } from '@/app/lib/data';
+import type { InvoiceStatusFilter } from '@/app/lib/schemas';
 
 export default async function InvoicesTable({
   query,
   currentPage,
+  status = null,
 }: {
   query: string;
   currentPage: number;
+  status?: InvoiceStatusFilter | null;
 }) {
-  const invoices = await fetchFilteredInvoices(query, currentPage);
+  const invoices = await fetchFilteredInvoices(query, currentPage, status);
 
   return (
     <div className="mt-6 flow-root">
diff --git a/tests/e2e/invoices-filter.spec.ts b/tests/e2e/invoices-filter.spec.ts
new file mode 100644
index 0000000..78b9239
--- /dev/null
+++ b/tests/e2e/invoices-filter.spec.ts
@@ -0,0 +1,89 @@
+import { type Page, expect, test } from '@playwright/test';
+
+// The invoice list's status filter, logged in as the demo user against the test
+// schema global-setup.ts rebuilds. It only reads: tests that run alongside may add
+// invoices, so it asserts on what each row says, never on counts beyond the seed.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+async function logIn(page: Page) {
+  await page.goto('/login');
+  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Password', { exact: true }).fill('123456');
+  await page.getByRole('button', { name: /log in/i }).click();
+  await expect(page).toHaveURL(/\/dashboard$/);
+}
+
+/** The desktop table's rows (the phone list is hidden at this width). */
+const rows = (page: Page) => page.locator('table tbody tr');
+
+const rowTexts = (page: Page) =>
+  rows(page).evaluateAll((all) => all.map((row) => row.textContent ?? ''));
+
+/**
+ * Every row of the table (read at once: the list streams in anew after each URL
+ * change) shows `status`, and the other status nowhere; and, if given, `text`.
+ */
+async function expectEveryRow(page: Page, status: 'Paid' | 'Pending', text?: string) {
+  const other = status === 'Paid' ? 'Pending' : 'Paid';
+  await expect
+    .poll(async () => {
+      const texts = await rows(page).evaluateAll((all) => all.map((row) => row.textContent ?? ''));
+      return (
+        texts.length > 0 &&
+        texts.every((t) => t.includes(status) && !t.includes(other) && (!text || t.includes(text)))
+      );
+    })
+    .toBe(true);
+}
+
+test('the status filter lives in the URL, combines with search and survives pagination', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await logIn(page);
+  await page.goto('/dashboard/invoices');
+  const filter = page.getByLabel('Status');
+  await expect(filter).toHaveValue('');
+
+  await filter.selectOption('paid');
+  await expect(page).toHaveURL(/[?&]status=paid/, { timeout: 15_000 });
+  await expectEveryRow(page, 'Paid');
+  const firstPage = await rowTexts(page);
+
+  // Eight seeded invoices are paid: two pages. Page 2 keeps the filter, and shows
+  // other paid invoices than page 1.
+  await page.getByRole('link', { name: '2', exact: true }).click();
+  await expect(page).toHaveURL(/status=paid/);
+  await expect(page).toHaveURL(/page=2/);
+  await expectEveryRow(page, 'Paid');
+  await expect
+    .poll(async () => (await rowTexts(page)).every((text) => !firstPage.includes(text)))
+    .toBe(true);
+  await expect(filter).toHaveValue('paid');
+
+  // With a search: both apply, and the page goes back to 1. Balazs Orban has paid
+  // and pending invoices, so each filter shows only some of his.
+  await page.getByPlaceholder('Search invoices...').fill('Balazs Orban');
+  await expect(page).toHaveURL(/query=Balazs\+Orban/);
+  await expect(page).toHaveURL(/page=1/);
+  await expect(page).toHaveURL(/status=paid/);
+  await expectEveryRow(page, 'Paid', 'Balazs Orban');
+  await filter.selectOption('pending');
+  await expect(page).toHaveURL(/status=pending/);
+  await expect(page).toHaveURL(/query=Balazs\+Orban/);
+  await expectEveryRow(page, 'Pending', 'Balazs Orban');
+
+  // Every status again (the search still applies).
+  await filter.selectOption('');
+  await expect(page).not.toHaveURL(/status=/);
+  await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
+  await expect(rows(page).filter({ hasText: 'Pending' }).first()).toBeVisible();
+});
+
+test('an unknown status in the URL shows every invoice', async ({ page }) => {
+  await logIn(page);
+  await page.goto('/dashboard/invoices?status=bogus');
+  await expect(page.getByLabel('Status')).toHaveValue('');
+  await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
+  await expect(rows(page).filter({ hasText: 'Pending' }).first()).toBeVisible();
+});
diff --git a/tests/unit/schemas.test.ts b/tests/unit/schemas.test.ts
index eea7d85..aefdf48 100644
--- a/tests/unit/schemas.test.ts
+++ b/tests/unit/schemas.test.ts
@@ -1,5 +1,11 @@
 import { describe, expect, it } from 'vitest';
-import { CreateInvoice, CustomerForm, CustomerId, UpdateInvoice } from '@/app/lib/schemas';
+import {
+  CreateInvoice,
+  CustomerForm,
+  CustomerId,
+  UpdateInvoice,
+  parseStatusFilter,
+} from '@/app/lib/schemas';
 
 // The actions pass formData.get(...) straight in, so a missing field arrives as null.
 const valid = { customerId: 'c0ffee', amount: '12.50', status: 'paid' };
@@ -97,3 +103,13 @@ describe('CustomerId', () => {
     }
   });
 });
+
+describe('parseStatusFilter', () => {
+  it('keeps a known status and drops anything else', () => {
+    expect(parseStatusFilter('paid')).toBe('paid');
+    expect(parseStatusFilter('pending')).toBe('pending');
+    for (const value of [undefined, '', 'PAID', 'overdue', "paid' OR 1=1"]) {
+      expect(parseStatusFilter(value)).toBeNull();
+    }
+  });
+});
~~~~

</details>

#### T12 — `night-2026-10-01-t12-invoice-detail`

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

<details><summary>Code:  13 files changed, 477 insertions(+), 25 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 95c304e..c3e83b5 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -108,7 +108,7 @@ jobs:
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers tests/e2e/invoices-filter
+          tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -176,7 +176,7 @@ jobs:
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers tests/e2e/invoices-filter
+          tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/app/dashboard/invoices/[id]/not-found.tsx b/app/dashboard/invoices/[id]/not-found.tsx
new file mode 100644
index 0000000..16338aa
--- /dev/null
+++ b/app/dashboard/invoices/[id]/not-found.tsx
@@ -0,0 +1,18 @@
+import Link from 'next/link';
+import { FaceFrownIcon } from '@heroicons/react/24/solid';
+
+export default function NotFound() {
+  return (
+    <main className="flex h-full flex-col items-center justify-center gap-2">
+      <FaceFrownIcon className="w-10 text-aura" />
+      <h2 className="text-xl font-semibold text-white">404 Not Found</h2>
+      <p className="text-aura">Could not find the requested invoice.</p>
+      <Link
+        href="/dashboard/invoices"
+        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
+      >
+        Go Back
+      </Link>
+    </main>
+  );
+}
diff --git a/app/dashboard/invoices/[id]/page.tsx b/app/dashboard/invoices/[id]/page.tsx
new file mode 100644
index 0000000..fe4bdf3
--- /dev/null
+++ b/app/dashboard/invoices/[id]/page.tsx
@@ -0,0 +1,72 @@
+import { Metadata } from 'next';
+import { notFound } from 'next/navigation';
+import { fetchInvoiceDetail } from '@/app/lib/data';
+import { InvoiceId } from '@/app/lib/schemas';
+import { formatCurrency, formatDateToLocal } from '@/app/lib/utils';
+import CustomerAvatar from '@/app/ui/customer-avatar';
+import { DeleteInvoice, UpdateInvoice } from '@/app/ui/invoices/buttons';
+import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
+import InvoiceStatus from '@/app/ui/invoices/status';
+
+export const metadata: Metadata = {
+  title: 'Invoice',
+};
+
+export default async function Page(props: { params: Promise<{ id: string }> }) {
+  const { id } = await props.params;
+  // Anything but a UUID names no invoice (and would be a database error).
+  const invoice = InvoiceId.safeParse(id).success ? await fetchInvoiceDetail(id) : undefined;
+  if (!invoice) notFound();
+
+  const amount = formatCurrency(invoice.amount);
+  const details = [
+    ['Amount', amount],
+    ['Date', formatDateToLocal(invoice.date)],
+    ['Customer email', invoice.email],
+    ['Invoice number', invoice.id],
+  ] as const;
+
+  return (
+    <main>
+      <Breadcrumbs
+        breadcrumbs={[
+          { label: 'Invoices', href: '/dashboard/invoices' },
+          { label: 'Invoice', href: `/dashboard/invoices/${id}`, active: true },
+        ]}
+      />
+      <section
+        aria-labelledby="invoice-heading"
+        className="rounded-2xl border border-line bg-panel p-4 md:p-6"
+      >
+        <div className="flex flex-wrap items-center justify-between gap-4">
+          <div className="flex items-center gap-3">
+            <CustomerAvatar name={invoice.name} size={40} />
+            <div>
+              <h1 id="invoice-heading" className="text-xl font-semibold text-white">
+                {invoice.name}
+              </h1>
+              <p className="text-sm text-aura">Invoice</p>
+            </div>
+          </div>
+          <div className="flex items-center gap-3">
+            <InvoiceStatus status={invoice.status} />
+            <UpdateInvoice id={invoice.id} />
+            <DeleteInvoice
+              id={invoice.id}
+              label={`invoice for ${invoice.name}, ${amount}`}
+              fromDetailPage
+            />
+          </div>
+        </div>
+        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
+          {details.map(([term, value]) => (
+            <div key={term} className="rounded-xl bg-void/60 p-4">
+              <dt className="text-xs text-aura">{term}</dt>
+              <dd className="mt-1 break-all text-base font-medium text-white">{value}</dd>
+            </div>
+          ))}
+        </dl>
+      </section>
+    </main>
+  );
+}
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index 5e12891..0eb400c 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -5,7 +5,13 @@ import { redirect } from 'next/navigation';
 import postgres from 'postgres';
 import { auth, signIn } from '@/auth';
 import { AuthError } from 'next-auth';
-import { CreateInvoice, CustomerForm, CustomerId, UpdateInvoice } from '@/app/lib/schemas';
+import {
+  CreateInvoice,
+  CustomerForm,
+  CustomerId,
+  InvoiceId,
+  UpdateInvoice,
+} from '@/app/lib/schemas';
 
 const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
@@ -47,7 +53,9 @@ export async function createInvoice(prevState: State, formData: FormData) {
 
   // Prepare data for insertion into the database
   const { customerId, amount, status } = validatedFields.data;
-  const amountInCents = amount * 100;
+  // Rounded: amount * 100 is not always a whole number in floating point (10000.37
+  // gives 1000037.0000000001), and the column is an integer.
+  const amountInCents = Math.round(amount * 100);
   const date = new Date().toISOString().split('T')[0];
 
   // Insert data into the database
@@ -88,7 +96,9 @@ export async function updateInvoice(id: string, prevState: State, formData: Form
   }
 
   const { customerId, amount, status } = validatedFields.data;
-  const amountInCents = amount * 100;
+  // Rounded: amount * 100 is not always a whole number in floating point (10000.37
+  // gives 1000037.0000000001), and the column is an integer.
+  const amountInCents = Math.round(amount * 100);
 
   try {
     await sql`
@@ -109,6 +119,10 @@ export async function deleteInvoice(id: string) {
   if (!(await isSignedIn())) {
     throw new Error('Unauthorized');
   }
+  // The id is the caller's: anything but a UUID names no invoice.
+  if (!InvoiceId.safeParse(id).success) {
+    throw new Error('No such invoice.');
+  }
 
   try {
     await sql`DELETE FROM invoices WHERE id = ${id}`;
@@ -121,6 +135,12 @@ export async function deleteInvoice(id: string) {
   revalidatePath('/dashboard/invoices');
 }
 
+/** Deletes from the invoice's own page, then goes to the list (the page is gone). */
+export async function deleteInvoiceAndReturn(id: string) {
+  await deleteInvoice(id);
+  redirect('/dashboard/invoices');
+}
+
 export type CustomerState = {
   errors?: {
     name?: string[];
diff --git a/app/lib/data.ts b/app/lib/data.ts
index cf1ecbf..8a690da 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -4,6 +4,7 @@ import {
   CustomerEdit,
   CustomerField,
   CustomersTableType,
+  InvoiceDetail,
   InvoiceForm,
   InvoicesTable,
   LatestInvoiceRaw,
@@ -222,6 +223,29 @@ export async function fetchInvoiceById(id: string) {
   }
 }
 
+/** One invoice with its customer, for the detail page; undefined if there is none. */
+export async function fetchInvoiceDetail(id: string) {
+  try {
+    const data = await sql<InvoiceDetail[]>`
+      SELECT
+        invoices.id,
+        invoices.amount,
+        invoices.status,
+        invoices.date,
+        customers.id AS customer_id,
+        customers.name,
+        customers.email
+      FROM invoices
+      JOIN customers ON invoices.customer_id = customers.id
+      WHERE invoices.id = ${id}
+    `;
+    return data[0];
+  } catch (error) {
+    console.error('Database Error:', error);
+    throw new Error('Failed to fetch invoice.');
+  }
+}
+
 export async function fetchCustomers() {
   try {
     const customers = await sql<CustomerField[]>`
diff --git a/app/lib/definitions.ts b/app/lib/definitions.ts
index a784c24..d531d20 100644
--- a/app/lib/definitions.ts
+++ b/app/lib/definitions.ts
@@ -103,3 +103,14 @@ export type InvoiceForm = {
   amount: number;
   status: 'pending' | 'paid';
 };
+
+/** An invoice and its customer, as the detail page shows them. */
+export type InvoiceDetail = {
+  id: string;
+  amount: number;
+  status: 'pending' | 'paid';
+  date: string;
+  customer_id: string;
+  name: string;
+  email: string;
+};
diff --git a/app/lib/schemas.ts b/app/lib/schemas.ts
index 4acef9d..b21027a 100644
--- a/app/lib/schemas.ts
+++ b/app/lib/schemas.ts
@@ -35,6 +35,9 @@ export const CustomerForm = z.object({
 /** A customer id from a URL or a form: anything but a UUID names no customer. */
 export const CustomerId = z.string().uuid();
 
+/** An invoice id from a URL or an action's argument, likewise. */
+export const InvoiceId = z.string().uuid();
+
 /** The invoice list's status filter, from the URL: anything unknown shows every status. */
 export const InvoiceStatusFilter = z.enum(['paid', 'pending']);
 export type InvoiceStatusFilter = z.infer<typeof InvoiceStatusFilter>;
diff --git a/app/ui/invoices/buttons.tsx b/app/ui/invoices/buttons.tsx
index 2cedd2f..917d635 100644
--- a/app/ui/invoices/buttons.tsx
+++ b/app/ui/invoices/buttons.tsx
@@ -1,6 +1,7 @@
-import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/20/solid';
+import { EyeIcon, PencilIcon, PlusIcon } from '@heroicons/react/20/solid';
 import Link from 'next/link';
-import { deleteInvoice } from '@/app/lib/actions';
+
+export { DeleteInvoice } from './delete-invoice';
 
 export function CreateInvoice() {
   return (
@@ -25,18 +26,14 @@ export function UpdateInvoice({ id }: { id: string }) {
   );
 }
 
-export function DeleteInvoice({ id }: { id: string }) {
-  const deleteInvoiceWithId = deleteInvoice.bind(null, id);
-
+export function ViewInvoice({ id, label }: { id: string; label: string }) {
   return (
-    <form action={deleteInvoiceWithId}>
-      <button
-        type="submit"
-        className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-red-400 hover:text-red-400"
-      >
-        <span className="sr-only">Delete</span>
-        <TrashIcon className="w-5" />
-      </button>
-    </form>
+    <Link
+      href={`/dashboard/invoices/${id}`}
+      className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-aura hover:text-white"
+    >
+      <span className="sr-only">View {label}</span>
+      <EyeIcon className="w-5" />
+    </Link>
   );
 }
diff --git a/app/ui/invoices/delete-invoice.tsx b/app/ui/invoices/delete-invoice.tsx
new file mode 100644
index 0000000..ef09678
--- /dev/null
+++ b/app/ui/invoices/delete-invoice.tsx
@@ -0,0 +1,123 @@
+'use client';
+
+import { TrashIcon } from '@heroicons/react/20/solid';
+import { useId, useRef, useState, useTransition } from 'react';
+import { deleteInvoice, deleteInvoiceAndReturn } from '@/app/lib/actions';
+
+/**
+ * The trash button, and the dialog that asks before deleting. A native modal
+ * <dialog>: the page behind it is inert, Esc cancels, and closing it puts focus
+ * back on the button that opened it. Tab and Shift+Tab also stay inside it.
+ */
+export function DeleteInvoice({
+  id,
+  label,
+  fromDetailPage = false,
+}: {
+  id: string;
+  /** What is being deleted, e.g. "invoice for Evil Rabbit, $666.00". */
+  label: string;
+  /** On the invoice's own page: once deleted, go to the list (the page is gone). */
+  fromDetailPage?: boolean;
+}) {
+  const dialogRef = useRef<HTMLDialogElement>(null);
+  const titleId = useId();
+  const descriptionId = useId();
+  const [pending, startTransition] = useTransition();
+  const [error, setError] = useState<string | null>(null);
+
+  const open = () => {
+    setError(null);
+    dialogRef.current?.showModal();
+  };
+  const close = () => dialogRef.current?.close();
+
+  const confirm = () =>
+    startTransition(async () => {
+      try {
+        // From the detail page the action itself redirects to the list.
+        await (fromDetailPage ? deleteInvoiceAndReturn : deleteInvoice)(id);
+      } catch {
+        setError('The invoice could not be deleted. Please try again.');
+        return;
+      }
+      close();
+      // The row, its button and this dialog are gone: give focus a place to land.
+      document.getElementById('search')?.focus();
+    });
+
+  // While deleting, the dialog stays open, so a failure can still be shown.
+  const onCancel = (event: React.SyntheticEvent<HTMLDialogElement>) => {
+    if (pending) event.preventDefault();
+  };
+
+  // Keep Tab and Shift+Tab on the dialog's own buttons.
+  const onKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
+    if (event.key !== 'Tab') return;
+    const buttons = Array.from(
+      event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')
+    );
+    if (buttons.length === 0) return;
+    const first = buttons[0];
+    const last = buttons[buttons.length - 1];
+    if (event.shiftKey && document.activeElement === first) {
+      event.preventDefault();
+      last.focus();
+    } else if (!event.shiftKey && document.activeElement === last) {
+      event.preventDefault();
+      first.focus();
+    }
+  };
+
+  return (
+    <>
+      <button
+        type="button"
+        onClick={open}
+        className="rounded-lg border border-line p-2 text-aura transition-colors hover:border-red-400 hover:text-red-400"
+      >
+        <span className="sr-only">Delete {label}</span>
+        <TrashIcon className="w-5" />
+      </button>
+      <dialog
+        ref={dialogRef}
+        aria-labelledby={titleId}
+        aria-describedby={descriptionId}
+        onKeyDown={onKeyDown}
+        onCancel={onCancel}
+        data-testid="delete-invoice-dialog"
+        className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-panel p-6 text-left text-white backdrop:bg-void/80"
+      >
+        <h2 id={titleId} className="font-display text-lg font-semibold text-cream">
+          Delete this invoice?
+        </h2>
+        <p id={descriptionId} className="mt-2 text-sm text-aura">
+          The {label} will be deleted. This cannot be undone.
+        </p>
+        <div aria-live="polite">
+          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
+        </div>
+        <div className="mt-6 flex justify-end gap-3">
+          {/* The safe choice has the focus when the dialog opens. */}
+          <button
+            type="button"
+            autoFocus
+            onClick={close}
+            disabled={pending}
+            className="flex h-10 items-center rounded-xl border border-line px-4 text-sm font-medium text-aura transition-colors hover:bg-void hover:text-white"
+          >
+            Cancel
+          </button>
+          <button
+            type="button"
+            onClick={confirm}
+            disabled={pending}
+            className="flex h-10 items-center rounded-xl bg-red-500 px-4 text-sm font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
+          >
+            {pending ? 'Deleting…' : 'Delete invoice'}
+          </button>
+        </div>
+      </dialog>
+    </>
+  );
+}
diff --git a/app/ui/invoices/table.tsx b/app/ui/invoices/table.tsx
index 96ea027..19334cb 100644
--- a/app/ui/invoices/table.tsx
+++ b/app/ui/invoices/table.tsx
@@ -1,10 +1,14 @@
 import CustomerAvatar from '@/app/ui/customer-avatar';
-import { UpdateInvoice, DeleteInvoice } from '@/app/ui/invoices/buttons';
+import { DeleteInvoice, UpdateInvoice, ViewInvoice } from '@/app/ui/invoices/buttons';
 import InvoiceStatus from '@/app/ui/invoices/status';
 import { formatDateToLocal, formatCurrency } from '@/app/lib/utils';
 import { fetchFilteredInvoices } from '@/app/lib/data';
 import type { InvoiceStatusFilter } from '@/app/lib/schemas';
 
+/** How an invoice is named to a screen reader: "invoice for Evil Rabbit, $666.00". */
+const label = (invoice: { name: string; amount: number }) =>
+  `invoice for ${invoice.name}, ${formatCurrency(invoice.amount)}`;
+
 export default async function InvoicesTable({
   query,
   currentPage,
@@ -41,8 +45,9 @@ export default async function InvoicesTable({
                     <p>{formatDateToLocal(invoice.date)}</p>
                   </div>
                   <div className="flex justify-end gap-2">
+                    <ViewInvoice id={invoice.id} label={label(invoice)} />
                     <UpdateInvoice id={invoice.id} />
-                    <DeleteInvoice id={invoice.id} />
+                    <DeleteInvoice id={invoice.id} label={label(invoice)} />
                   </div>
                 </div>
               </div>
@@ -91,8 +96,9 @@ export default async function InvoicesTable({
                   </td>
                   <td className="whitespace-nowrap py-3 pl-6 pr-3">
                     <div className="flex justify-end gap-3">
+                      <ViewInvoice id={invoice.id} label={label(invoice)} />
                       <UpdateInvoice id={invoice.id} />
-                      <DeleteInvoice id={invoice.id} />
+                      <DeleteInvoice id={invoice.id} label={label(invoice)} />
                     </div>
                   </td>
                 </tr>
diff --git a/tests/e2e/invoice-detail.spec.ts b/tests/e2e/invoice-detail.spec.ts
new file mode 100644
index 0000000..f4290a4
--- /dev/null
+++ b/tests/e2e/invoice-detail.spec.ts
@@ -0,0 +1,118 @@
+import { type Page, expect, test } from '@playwright/test';
+
+// The invoice detail page and the delete confirmation dialog, logged in as the
+// demo user against the test schema global-setup.ts rebuilds. Each test makes its
+// own pending invoice (an amount no other test uses) and asserts only on it.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+async function logIn(page: Page) {
+  await page.goto('/login');
+  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Password', { exact: true }).fill('123456');
+  await page.getByRole('button', { name: /log in/i }).click();
+  await expect(page).toHaveURL(/\/dashboard$/);
+}
+
+/** Creates a pending invoice for Amy Burns with a unique amount; returns its cents. */
+async function createInvoice(page: Page) {
+  const cents = 1_000_000 + Math.floor(Math.random() * 8_999_999);
+  await page.goto('/dashboard/invoices/create');
+  // Filled before hydration, the form would be reset under the test's hands.
+  await page.waitForLoadState('networkidle');
+  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
+  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
+  await page.getByLabel('Pending').check();
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+  return cents;
+}
+
+const dollars = (cents: number) =>
+  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
+
+/** The invoice list searched down to that amount (the search matches cents). */
+async function findInvoice(page: Page, cents: number) {
+  await page.goto(`/dashboard/invoices?query=${cents}`);
+  return page.locator('table tbody tr').filter({ hasText: dollars(cents) });
+}
+
+test('an invoice has a detail page, reached from the list', async ({ page }) => {
+  await logIn(page);
+  const cents = await createInvoice(page);
+  const row = await findInvoice(page, cents);
+  await row.getByRole('link', { name: `View invoice for Amy Burns, ${dollars(cents)}` }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
+  await expect(page.getByRole('heading', { name: 'Amy Burns' })).toBeVisible();
+  const details = page.locator('dl');
+  await expect(details).toContainText(dollars(cents));
+  await expect(details).toContainText('amy@burns.com');
+  await expect(page.getByText('Pending')).toBeVisible();
+});
+
+test('deleting asks first, in a dialog that keeps focus, cancels on Esc and gives focus back', async ({
+  page,
+}) => {
+  await logIn(page);
+  const cents = await createInvoice(page);
+  const row = await findInvoice(page, cents);
+  const trash = row.getByRole('button', {
+    name: `Delete invoice for Amy Burns, ${dollars(cents)}`,
+  });
+  const dialog = page.getByRole('dialog', { name: 'Delete this invoice?' });
+
+  await trash.click();
+  await expect(dialog).toBeVisible();
+  await expect(dialog).toContainText(`invoice for Amy Burns, ${dollars(cents)}`);
+  const cancel = dialog.getByRole('button', { name: 'Cancel' });
+  const confirm = dialog.getByRole('button', { name: 'Delete invoice' });
+  // The safe choice has the focus, and Tab stays inside the dialog.
+  await expect(cancel).toBeFocused();
+  await page.keyboard.press('Tab');
+  await expect(confirm).toBeFocused();
+  await page.keyboard.press('Tab');
+  await expect(cancel).toBeFocused();
+  await page.keyboard.press('Shift+Tab');
+  await expect(confirm).toBeFocused();
+
+  // Esc cancels, and the focus goes back to the button that opened it.
+  await page.keyboard.press('Escape');
+  await expect(dialog).toBeHidden();
+  await expect(trash).toBeFocused();
+  await expect(row).toHaveCount(1);
+
+  // Cancel does the same.
+  await trash.click();
+  await cancel.click();
+  await expect(dialog).toBeHidden();
+  await expect(trash).toBeFocused();
+  await expect(row).toHaveCount(1);
+
+  // Confirming deletes it; focus lands on the search box (its row is gone).
+  await trash.click();
+  await confirm.click();
+  await expect(dialog).toBeHidden();
+  await expect(page.getByPlaceholder('Search invoices...')).toBeFocused();
+  await expect(page.locator('table tbody tr').filter({ hasText: dollars(cents) })).toHaveCount(0);
+});
+
+test('deleting from the detail page goes back to the list', async ({ page }) => {
+  await logIn(page);
+  const cents = await createInvoice(page);
+  const row = await findInvoice(page, cents);
+  await row.getByRole('link', { name: /^View invoice/ }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
+  const detail = page.url();
+  await page.getByRole('button', { name: /^Delete invoice for Amy Burns/ }).click();
+  await page.getByRole('dialog').getByRole('button', { name: 'Delete invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+  await page.goto(detail);
+  await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
+});
+
+test('an invoice that does not exist shows not found', async ({ page }) => {
+  await logIn(page);
+  for (const id of ['00000000-0000-4000-8000-000000000000', 'not-a-uuid']) {
+    await page.goto(`/dashboard/invoices/${id}`);
+    await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
+  }
+});
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index 753e53e..0b5a04c 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -19,6 +19,7 @@ const {
   createInvoice,
   updateInvoice,
   deleteInvoice,
+  deleteInvoiceAndReturn,
   createCustomer,
   updateCustomer,
   deleteCustomer,
@@ -66,6 +67,11 @@ describe('without a session', () => {
     expect(revalidatePath).not.toHaveBeenCalled();
   });
 
+  it('deleteInvoice refuses even before looking at the id', async () => {
+    await expect(deleteInvoice('not-a-uuid')).rejects.toThrow('Unauthorized');
+    expect(sql).not.toHaveBeenCalled();
+  });
+
   it('treats a session without a user as signed out', async () => {
     auth.mockResolvedValue({ expires: '2099-01-01' });
     await expect(deleteInvoice('i1')).rejects.toThrow('Unauthorized');
@@ -98,15 +104,15 @@ describe('with a session', () => {
   });
 
   it('deleteInvoice deletes and revalidates the list', async () => {
-    await deleteInvoice('i1');
-    expect(sql.mock.calls[0].slice(1)).toEqual(['i1']);
+    await deleteInvoice('cc27c14a-0acf-4f4a-a6c9-d45682c144b9');
+    expect(sql.mock.calls[0].slice(1)).toEqual(['cc27c14a-0acf-4f4a-a6c9-d45682c144b9']);
     expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
   });
 
   it('deleteInvoice hides the database error from the client', async () => {
     const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
     sql.mockRejectedValue(new Error('connection to db.internal:5432 refused'));
-    const failure = deleteInvoice('i1');
+    const failure = deleteInvoice('cc27c14a-0acf-4f4a-a6c9-d45682c144b9');
     await expect(failure).rejects.toThrow('Database Error: Failed to Delete Invoice.');
     await expect(failure).rejects.not.toThrow(/db\.internal/);
     expect(consoleError).toHaveBeenCalled();
@@ -222,3 +228,47 @@ describe('customer actions', () => {
     });
   });
 });
+
+describe('deleteInvoice with a session', () => {
+  beforeEach(() => auth.mockResolvedValue(signedIn));
+
+  it('a malformed id never reaches the database', async () => {
+    for (const bad of ['', 'i1', "' OR 1=1 --"]) {
+      await expect(deleteInvoice(bad)).rejects.toThrow('No such invoice.');
+    }
+    expect(sql).not.toHaveBeenCalled();
+  });
+
+  it('from the detail page, deletes and then goes to the list', async () => {
+    await deleteInvoiceAndReturn('3958dc9e-712f-4377-85e9-fec4b6a6442a');
+    expect(sql).toHaveBeenCalledTimes(1);
+    expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
+  });
+
+  it('from the detail page, goes nowhere when the delete is refused', async () => {
+    await expect(deleteInvoiceAndReturn('bad')).rejects.toThrow('No such invoice.');
+    expect(redirect).not.toHaveBeenCalled();
+  });
+
+  it('deletes by id and refreshes the list', async () => {
+    await deleteInvoice('3958dc9e-712f-4377-85e9-fec4b6a6442a');
+    expect(sql).toHaveBeenCalledTimes(1);
+    expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
+  });
+});
+
+describe('amounts in cents', () => {
+  beforeEach(() => auth.mockResolvedValue(signedIn));
+
+  it('are whole numbers, even where floating point is not (10000.37 × 100)', async () => {
+    await createInvoice({}, invoiceForm({ amount: '10000.37' }));
+    expect(sql.mock.calls[0][2]).toBe(1000037);
+    sql.mockClear();
+    await updateInvoice(
+      'cc27c14a-0acf-4f4a-a6c9-d45682c144b9',
+      {},
+      invoiceForm({ amount: '0.29' })
+    );
+    expect(sql.mock.calls[0][2]).toBe(29);
+  });
+});
diff --git a/tests/unit/schemas.test.ts b/tests/unit/schemas.test.ts
index aefdf48..6dcbe98 100644
--- a/tests/unit/schemas.test.ts
+++ b/tests/unit/schemas.test.ts
@@ -3,6 +3,7 @@ import {
   CreateInvoice,
   CustomerForm,
   CustomerId,
+  InvoiceId,
   UpdateInvoice,
   parseStatusFilter,
 } from '@/app/lib/schemas';
@@ -95,6 +96,15 @@ describe('CustomerForm', () => {
   });
 });
 
+describe('InvoiceId', () => {
+  it('is a UUID, or nothing', () => {
+    expect(InvoiceId.safeParse('cc27c14a-0acf-4f4a-a6c9-d45682c144b9').success).toBe(true);
+    for (const id of ['', 'i1', '../../etc', 'cc27c14a-0acf']) {
+      expect(InvoiceId.safeParse(id).success).toBe(false);
+    }
+  });
+});
+
 describe('CustomerId', () => {
   it('is a UUID, or nothing', () => {
     expect(CustomerId.safeParse('3958dc9e-712f-4377-85e9-fec4b6a6442a').success).toBe(true);
~~~~

</details>

#### T13 — `night-2026-10-01-t13-csv-export`

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

<details><summary>Code:  9 files changed, 363 insertions(+)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index c3e83b5..c1173dc 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -31,6 +31,7 @@ jobs:
         run: >-
           npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
           tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher tests/unit/seed-data
+          tests/unit/csv tests/unit/export-route
       - name: Unit tests (cats, Node)
         if: ${{ !cancelled() }}
         run: >-
@@ -109,6 +110,7 @@ jobs:
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
           tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
+          tests/e2e/invoice-export
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -177,6 +179,7 @@ jobs:
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
           tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
+          tests/e2e/invoice-export
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/app/dashboard/invoices/export/route.ts b/app/dashboard/invoices/export/route.ts
new file mode 100644
index 0000000..ccfb498
--- /dev/null
+++ b/app/dashboard/invoices/export/route.ts
@@ -0,0 +1,50 @@
+import { auth } from '@/auth';
+import { toCsv } from '@/app/lib/csv';
+import { EXPORT_LIMIT, fetchInvoicesForExport } from '@/app/lib/data';
+import { parseStatusFilter } from '@/app/lib/schemas';
+
+// The invoice list as CSV, filtered as the list is (`?query=`, `?status=`).
+// It checks the session itself: proxy.ts guards pages, but a route handler is an
+// endpoint anyone can call directly.
+export async function GET(request: Request) {
+  const session = await auth();
+  if (!session?.user) {
+    return new Response('You must be logged in to export invoices.', {
+      status: 401,
+      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
+    });
+  }
+
+  const params = new URL(request.url).searchParams;
+  const query = params.get('query') ?? '';
+  const status = parseStatusFilter(params.get('status') ?? undefined);
+  const invoices = await fetchInvoicesForExport(query, status);
+  // Never a file that looks complete but is not.
+  if (invoices.length > EXPORT_LIMIT) {
+    return new Response(
+      `More than ${EXPORT_LIMIT.toLocaleString('en-US')} invoices match. Narrow the search or the status filter, then export again.`,
+      { status: 422, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
+    );
+  }
+
+  const csv = toCsv([
+    ['Date', 'Customer', 'Email', 'Amount', 'Status'],
+    ...invoices.map((invoice) => [
+      invoice.date,
+      invoice.name,
+      invoice.email,
+      // Dollars with cents, as text: a spreadsheet reads it as a number.
+      (invoice.amount / 100).toFixed(2),
+      invoice.status,
+    ]),
+  ]);
+
+  // A byte-order mark, so Excel reads the file as UTF-8.
+  return new Response(`\uFEFF${csv}`, {
+    headers: {
+      'Content-Type': 'text/csv; charset=utf-8',
+      'Content-Disposition': 'attachment; filename="invoices.csv"',
+      'Cache-Control': 'no-store',
+    },
+  });
+}
diff --git a/app/dashboard/invoices/page.tsx b/app/dashboard/invoices/page.tsx
index b1f5aca..70bf004 100644
--- a/app/dashboard/invoices/page.tsx
+++ b/app/dashboard/invoices/page.tsx
@@ -8,6 +8,7 @@ import { fetchInvoicesPages } from '@/app/lib/data';
 import { Metadata } from 'next';
 import { parseStatusFilter } from '@/app/lib/schemas';
 import StatusFilter from '@/app/ui/invoices/status-filter';
+import ExportInvoices from '@/app/ui/invoices/export-invoices';
 
 export const metadata: Metadata = {
   title: 'Invoices',
@@ -37,6 +38,7 @@ export default async function Page(props: {
       <div className="mt-4 flex items-center justify-between gap-2 md:mt-8">
         <Search placeholder="Search invoices..." />
         <StatusFilter />
+        <ExportInvoices query={query} status={status} />
         <CreateInvoice />
       </div>
       <Suspense key={`${query}|${currentPage}|${status}`} fallback={<InvoicesTableSkeleton />}>
diff --git a/app/lib/csv.ts b/app/lib/csv.ts
new file mode 100644
index 0000000..a260b5f
--- /dev/null
+++ b/app/lib/csv.ts
@@ -0,0 +1,25 @@
+// CSV for spreadsheets. Two things make a cell safe to open in Excel, Numbers or
+// Sheets: text a spreadsheet could take for a formula is prefixed with an
+// apostrophe, so it is shown, never run (CSV "formula injection"); and a cell with
+// a quote, comma, line break or edge space is quoted, with its quotes doubled
+// (RFC 4180). Numbers are written as they are.
+//
+// "Could take for a formula": it starts with = + - @ (or their full-width forms,
+// which some locales accept), possibly after spaces or control characters an
+// importer may trim, or it starts with a tab, carriage return or line feed.
+
+const LOOKS_LIKE_A_FORMULA = /^[\s\u0000-\u001f]*[=+\-@\uFF1D\uFF0B\uFF0D\uFF20]|^[\t\r\n]/;
+const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;
+
+/** One cell, safe to open in a spreadsheet. */
+export function csvCell(value: string | number): string {
+  let text = String(value);
+  if (typeof value === 'string' && LOOKS_LIKE_A_FORMULA.test(text)) text = `'${text}`;
+  if (NEEDS_QUOTES.test(text)) text = `"${text.replace(/"/g, '""')}"`;
+  return text;
+}
+
+/** Rows of cells as CSV text, each line ending in CRLF. */
+export function toCsv(rows: readonly (readonly (string | number)[])[]): string {
+  return rows.map((row) => row.map(csvCell).join(',') + '\r\n').join('');
+}
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 8a690da..65bff0d 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -173,6 +173,46 @@ export async function fetchFilteredInvoices(
   }
 }
 
+/** The most rows one CSV export holds. */
+export const EXPORT_LIMIT = 10_000;
+
+/**
+ * Every invoice matching the list's search and status, newest first: at most
+ * EXPORT_LIMIT + 1 rows, so a caller can tell there were more than it may export.
+ */
+export async function fetchInvoicesForExport(
+  query: string,
+  status: InvoiceStatusFilter | null = null
+) {
+  try {
+    return await sql<
+      { date: string; name: string; email: string; amount: number; status: string }[]
+    >`
+      SELECT
+        to_char(invoices.date, 'YYYY-MM-DD') AS date,
+        customers.name,
+        customers.email,
+        invoices.amount,
+        invoices.status
+      FROM invoices
+      JOIN customers ON invoices.customer_id = customers.id
+      WHERE (
+        customers.name ILIKE ${`%${query}%`} OR
+        customers.email ILIKE ${`%${query}%`} OR
+        invoices.amount::text ILIKE ${`%${query}%`} OR
+        invoices.date::text ILIKE ${`%${query}%`} OR
+        invoices.status ILIKE ${`%${query}%`}
+      )
+      AND (${status}::text IS NULL OR invoices.status = ${status})
+      ORDER BY invoices.date DESC
+      LIMIT ${EXPORT_LIMIT + 1}
+    `;
+  } catch (error) {
+    console.error('Database Error:', error);
+    throw new Error('Failed to export invoices.');
+  }
+}
+
 export async function fetchInvoicesPages(query: string, status: InvoiceStatusFilter | null = null) {
   try {
     const data = await sql`SELECT COUNT(*)
diff --git a/app/ui/invoices/export-invoices.tsx b/app/ui/invoices/export-invoices.tsx
new file mode 100644
index 0000000..511f4e6
--- /dev/null
+++ b/app/ui/invoices/export-invoices.tsx
@@ -0,0 +1,29 @@
+import { ArrowDownTrayIcon } from '@heroicons/react/20/solid';
+import type { InvoiceStatusFilter } from '@/app/lib/schemas';
+
+/** Downloads the invoice list as CSV, filtered as it is shown (search and status). */
+export default function ExportInvoices({
+  query,
+  status,
+}: {
+  query: string;
+  status: InvoiceStatusFilter | null;
+}) {
+  const params = new URLSearchParams();
+  if (query) params.set('query', query);
+  if (status) params.set('status', status);
+  const search = params.toString();
+
+  return (
+    // A plain link (nothing to prefetch): the route answers with an attachment. No
+    // `download` attribute, so an expired session shows the login page, not a file.
+    <a
+      href={`/dashboard/invoices/export${search ? `?${search}` : ''}`}
+      className="flex h-10 flex-none items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium text-aura transition-colors hover:border-aura hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
+    >
+      <ArrowDownTrayIcon className="h-5" />
+      <span className="hidden md:block">Export CSV</span>
+      <span className="sr-only md:hidden">Export CSV</span>
+    </a>
+  );
+}
diff --git a/tests/e2e/invoice-export.spec.ts b/tests/e2e/invoice-export.spec.ts
new file mode 100644
index 0000000..462cd6c
--- /dev/null
+++ b/tests/e2e/invoice-export.spec.ts
@@ -0,0 +1,61 @@
+import { readFileSync } from 'node:fs';
+import { type Page, expect, test } from '@playwright/test';
+
+// The CSV export of the invoice list, against the test schema global-setup.ts
+// rebuilds. The test makes its own customer, named like a spreadsheet formula, and
+// its own invoice, and asserts only on them.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+async function logIn(page: Page) {
+  await page.goto('/login');
+  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Password', { exact: true }).fill('123456');
+  await page.getByRole('button', { name: /log in/i }).click();
+  await expect(page).toHaveURL(/\/dashboard$/);
+}
+
+test('the export is the filtered list as CSV, with formulas made harmless', async ({ page }) => {
+  test.setTimeout(60_000);
+  await logIn(page);
+  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
+  const name = `=1+1 Formula ${tag}`;
+
+  await page.goto('/dashboard/customers/create');
+  await page.waitForLoadState('networkidle');
+  await page.getByLabel('Name').fill(name);
+  await page.getByLabel('Email').fill(`${tag}@example.com`);
+  await page.getByRole('button', { name: 'Create Customer' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
+
+  await page.goto('/dashboard/invoices/create');
+  await page.waitForLoadState('networkidle');
+  await page.getByLabel('Choose customer').selectOption({ label: name });
+  await page.getByLabel('Choose an amount').fill('12.34');
+  await page.getByLabel('Pending').check();
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+
+  // The list filtered to this customer's pending invoices; the link keeps both.
+  await page.goto(`/dashboard/invoices?query=${tag}&status=pending`);
+  const link = page.getByRole('link', { name: 'Export CSV' });
+  await expect(link).toHaveAttribute(
+    'href',
+    `/dashboard/invoices/export?query=${tag}&status=pending`
+  );
+
+  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
+  expect(download.suggestedFilename()).toBe('invoices.csv');
+  const csv = readFileSync((await download.path())!, 'utf8').replace(/^\uFEFF/, '');
+  const lines = csv.split('\r\n').filter(Boolean);
+  expect(lines[0]).toBe('Date,Customer,Email,Amount,Status');
+  // Only this customer's invoice, and the name can no longer run as a formula.
+  expect(lines.slice(1)).toEqual([
+    `${new Date().toISOString().slice(0, 10)},'${name},${tag}@example.com,12.34,pending`,
+  ]);
+});
+
+test('a visitor who is not logged in gets no CSV', async ({ request }) => {
+  const response = await request.get('/dashboard/invoices/export', { maxRedirects: 0 });
+  expect(response.headers()['content-type'] ?? '').not.toContain('text/csv');
+  expect([302, 303, 307, 401]).toContain(response.status());
+});
diff --git a/tests/unit/csv.test.ts b/tests/unit/csv.test.ts
new file mode 100644
index 0000000..c8218bc
--- /dev/null
+++ b/tests/unit/csv.test.ts
@@ -0,0 +1,64 @@
+import { describe, expect, it } from 'vitest';
+import { csvCell, toCsv } from '@/app/lib/csv';
+
+describe('csvCell', () => {
+  it('leaves plain text and numbers alone', () => {
+    expect(csvCell('Evil Rabbit')).toBe('Evil Rabbit');
+    expect(csvCell('a-b+c@d.example')).toBe('a-b+c@d.example');
+    expect(csvCell('2023-06-27')).toBe('2023-06-27');
+    expect(csvCell('666.00')).toBe('666.00');
+    expect(csvCell(42)).toBe('42');
+  });
+
+  it('defuses text a spreadsheet would run as a formula', () => {
+    for (const formula of [
+      '=HYPERLINK("http://evil.example","click")',
+      '+1+1',
+      '-2+3',
+      '@SUM(A1:A2)',
+      '\t=1+1',
+      '\r=1+1',
+    ]) {
+      const cell = csvCell(formula);
+      // Shown as text: starts with an apostrophe (inside quotes if quoting was needed).
+      expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
+    }
+    expect(csvCell('=1+1')).toBe("'=1+1");
+  });
+
+  it('also when the formula hides behind spaces, control characters or a line feed', () => {
+    for (const hidden of [
+      ' =1+1',
+      '  @SUM(A1)',
+      '\n=1+1',
+      '\u0000=1+1',
+      '\n',
+      '\uFF1D1+1', // full-width =
+    ]) {
+      expect(csvCell(hidden).replace(/^"/, '').startsWith("'"), JSON.stringify(hidden)).toBe(true);
+    }
+  });
+
+  it('quotes cells with commas, quotes, line breaks or edge spaces, doubling quotes', () => {
+    expect(csvCell('Acme, Inc.')).toBe('"Acme, Inc."');
+    expect(csvCell('the "best"')).toBe('"the ""best"""');
+    expect(csvCell('two\nlines')).toBe('"two\nlines"');
+    expect(csvCell(' padded ')).toBe('" padded "');
+  });
+
+  it('does both for a formula with a comma', () => {
+    expect(csvCell('=SUM(1,2)')).toBe(`"'=SUM(1,2)"`);
+  });
+});
+
+describe('toCsv', () => {
+  it('joins cells with commas and rows with CRLF', () => {
+    expect(
+      toCsv([
+        ['Customer', 'Amount'],
+        ['Acme, Inc.', '1.50'],
+        ['=evil', '2.00'],
+      ])
+    ).toBe(`Customer,Amount\r\n"Acme, Inc.",1.50\r\n'=evil,2.00\r\n`);
+  });
+});
diff --git a/tests/unit/export-route.test.ts b/tests/unit/export-route.test.ts
new file mode 100644
index 0000000..7f7689f
--- /dev/null
+++ b/tests/unit/export-route.test.ts
@@ -0,0 +1,89 @@
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+
+// The CSV export route, with the session and the database replaced by fakes.
+const { auth, fetchInvoicesForExport } = vi.hoisted(() => ({
+  auth: vi.fn(),
+  fetchInvoicesForExport: vi.fn(),
+}));
+vi.mock('@/auth', () => ({ auth }));
+// A cap of 2 rows, so the over-the-cap case needs only three.
+vi.mock('@/app/lib/data', () => ({ EXPORT_LIMIT: 2, fetchInvoicesForExport }));
+
+const { GET } = await import('@/app/dashboard/invoices/export/route');
+
+const request = (search = '') => new Request(`http://localhost/dashboard/invoices/export${search}`);
+
+beforeEach(() => {
+  vi.clearAllMocks();
+  fetchInvoicesForExport.mockResolvedValue([
+    {
+      date: '2023-06-27',
+      name: 'Evil Rabbit',
+      email: 'evil@rabbit.com',
+      amount: 66600,
+      status: 'pending',
+    },
+    { date: '2023-06-09', name: '=HYPERLINK("x")', email: 'a@b.c', amount: 5, status: 'paid' },
+  ]);
+});
+
+describe('without a session', () => {
+  it('refuses with 401 and reads nothing', async () => {
+    auth.mockResolvedValue(null);
+    const response = await GET(request());
+    expect(response.status).toBe(401);
+    expect(response.headers.get('Content-Type')).toContain('text/plain');
+    expect(fetchInvoicesForExport).not.toHaveBeenCalled();
+  });
+
+  it('treats a session without a user as none', async () => {
+    auth.mockResolvedValue({ expires: '2099-01-01' });
+    expect((await GET(request())).status).toBe(401);
+    expect(fetchInvoicesForExport).not.toHaveBeenCalled();
+  });
+});
+
+describe('with a session', () => {
+  beforeEach(() => auth.mockResolvedValue({ user: { email: 'user@nextmail.com' } }));
+
+  it('sends a CSV download of the filtered list, safe for spreadsheets', async () => {
+    const response = await GET(request('?query=rabbit&status=pending'));
+    expect(response.status).toBe(200);
+    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
+    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="invoices.csv"');
+    expect(response.headers.get('Cache-Control')).toBe('no-store');
+    expect(fetchInvoicesForExport).toHaveBeenCalledWith('rabbit', 'pending');
+
+    // A UTF-8 byte-order mark first (text() would drop it, so read the bytes).
+    const bytes = new Uint8Array(await response.clone().arrayBuffer());
+    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
+    const body = await response.text();
+    expect(body.split('\r\n')).toEqual([
+      'Date,Customer,Email,Amount,Status',
+      '2023-06-27,Evil Rabbit,evil@rabbit.com,666.00,pending',
+      `2023-06-09,"'=HYPERLINK(""x"")",a@b.c,0.05,paid`,
+      '',
+    ]);
+  });
+
+  it('refuses rather than send a file that is cut short', async () => {
+    fetchInvoicesForExport.mockResolvedValue(
+      [1, 2, 3].map((n) => ({
+        date: '2023-01-0' + n,
+        name: 'n',
+        email: 'e',
+        amount: n,
+        status: 'paid',
+      }))
+    );
+    const response = await GET(request());
+    expect(response.status).toBe(422);
+    expect(response.headers.get('Content-Type')).toContain('text/plain');
+    expect(await response.text()).toContain('Narrow the search');
+  });
+
+  it('ignores an unknown status, as the list does', async () => {
+    await GET(request('?status=bogus'));
+    expect(fetchInvoicesForExport).toHaveBeenCalledWith('', null);
+  });
+});
~~~~

</details>

#### T14 — `night-2026-10-01-t14-due-dates`

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

<details><summary>Code:  18 files changed, 213 insertions(+), 48 deletions(-)</summary>

~~~~diff
diff --git a/app/dashboard/invoices/[id]/page.tsx b/app/dashboard/invoices/[id]/page.tsx
index fe4bdf3..0b8b857 100644
--- a/app/dashboard/invoices/[id]/page.tsx
+++ b/app/dashboard/invoices/[id]/page.tsx
@@ -22,6 +22,7 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
   const details = [
     ['Amount', amount],
     ['Date', formatDateToLocal(invoice.date)],
+    ['Due', formatDateToLocal(invoice.due_date)],
     ['Customer email', invoice.email],
     ['Invoice number', invoice.id],
   ] as const;
@@ -49,7 +50,7 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
             </div>
           </div>
           <div className="flex items-center gap-3">
-            <InvoiceStatus status={invoice.status} />
+            <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
             <UpdateInvoice id={invoice.id} />
             <DeleteInvoice
               id={invoice.id}
diff --git a/app/dashboard/invoices/export/route.ts b/app/dashboard/invoices/export/route.ts
index ccfb498..bbad9a0 100644
--- a/app/dashboard/invoices/export/route.ts
+++ b/app/dashboard/invoices/export/route.ts
@@ -28,14 +28,16 @@ export async function GET(request: Request) {
   }
 
   const csv = toCsv([
-    ['Date', 'Customer', 'Email', 'Amount', 'Status'],
+    ['Date', 'Due', 'Customer', 'Email', 'Amount', 'Status'],
     ...invoices.map((invoice) => [
       invoice.date,
+      invoice.due_date,
       invoice.name,
       invoice.email,
       // Dollars with cents, as text: a spreadsheet reads it as a number.
       (invoice.amount / 100).toFixed(2),
-      invoice.status,
+      // As the list shows it: pending past its due date is overdue.
+      invoice.status === 'pending' && invoice.overdue ? 'overdue' : invoice.status,
     ]),
   ]);
 
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index 0eb400c..40e764d 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -57,12 +57,13 @@ export async function createInvoice(prevState: State, formData: FormData) {
   // gives 1000037.0000000001), and the column is an integer.
   const amountInCents = Math.round(amount * 100);
   const date = new Date().toISOString().split('T')[0];
+  // Due 30 days after its date: the payment term (db/migrations/0003).
 
   // Insert data into the database
   try {
     await sql`
-      INSERT INTO invoices (customer_id, amount, status, date)
-      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
+      INSERT INTO invoices (customer_id, amount, status, date, due_date)
+      VALUES (${customerId}, ${amountInCents}, ${status}, ${date}, ${date}::date + 30)
     `;
   } catch (error) {
     // Log the database error on the server; return only a generic message.
diff --git a/app/lib/data.ts b/app/lib/data.ts
index 65bff0d..5e43945 100644
--- a/app/lib/data.ts
+++ b/app/lib/data.ts
@@ -16,10 +16,24 @@ import { Range, lastTwelveMonths, monthStart, percentChange } from './dashboard'
 
 const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
+/** Unpaid and past its due date: worked out when read, never stored. */
+const isOverdue = () => sql`(invoices.status = 'pending' AND invoices.due_date < CURRENT_DATE)`;
+
+/**
+ * The invoice list's status filter. Each invoice is in exactly one of paid,
+ * pending (unpaid, not yet due) and overdue; null matches every invoice.
+ */
+const matchesStatus = (status: InvoiceStatusFilter | null) => {
+  if (status === 'overdue') return isOverdue();
+  if (status === 'pending') return sql`(invoices.status = 'pending' AND NOT ${isOverdue()})`;
+  if (status === 'paid') return sql`invoices.status = 'paid'`;
+  return sql`TRUE`;
+};
+
 export async function fetchLatestInvoices() {
   try {
     const data = await sql<LatestInvoiceRaw[]>`
-      SELECT invoices.amount, invoices.date, invoices.status, customers.name, customers.image_url, customers.email, invoices.id
+      SELECT invoices.amount, invoices.date, invoices.status, ${isOverdue()} AS overdue, customers.name, customers.image_url, customers.email, invoices.id
       FROM invoices
       JOIN customers ON invoices.customer_id = customers.id
       ORDER BY invoices.date DESC
@@ -149,6 +163,7 @@ export async function fetchFilteredInvoices(
         invoices.amount,
         invoices.date,
         invoices.status,
+        ${isOverdue()} AS overdue,
         customers.name,
         customers.email,
         customers.image_url
@@ -161,7 +176,7 @@ export async function fetchFilteredInvoices(
         invoices.date::text ILIKE ${`%${query}%`} OR
         invoices.status ILIKE ${`%${query}%`}
       )
-      AND (${status}::text IS NULL OR invoices.status = ${status})
+      AND ${matchesStatus(status)}
       ORDER BY invoices.date DESC
       LIMIT ${ITEMS_PER_PAGE} OFFSET ${offset}
     `;
@@ -186,14 +201,24 @@ export async function fetchInvoicesForExport(
 ) {
   try {
     return await sql<
-      { date: string; name: string; email: string; amount: number; status: string }[]
+      {
+        date: string;
+        due_date: string;
+        name: string;
+        email: string;
+        amount: number;
+        status: string;
+        overdue: boolean;
+      }[]
     >`
       SELECT
         to_char(invoices.date, 'YYYY-MM-DD') AS date,
+        to_char(invoices.due_date, 'YYYY-MM-DD') AS due_date,
         customers.name,
         customers.email,
         invoices.amount,
-        invoices.status
+        invoices.status,
+        ${isOverdue()} AS overdue
       FROM invoices
       JOIN customers ON invoices.customer_id = customers.id
       WHERE (
@@ -203,7 +228,7 @@ export async function fetchInvoicesForExport(
         invoices.date::text ILIKE ${`%${query}%`} OR
         invoices.status ILIKE ${`%${query}%`}
       )
-      AND (${status}::text IS NULL OR invoices.status = ${status})
+      AND ${matchesStatus(status)}
       ORDER BY invoices.date DESC
       LIMIT ${EXPORT_LIMIT + 1}
     `;
@@ -225,7 +250,7 @@ export async function fetchInvoicesPages(query: string, status: InvoiceStatusFil
       invoices.date::text ILIKE ${`%${query}%`} OR
       invoices.status ILIKE ${`%${query}%`}
     )
-    AND (${status}::text IS NULL OR invoices.status = ${status})
+    AND ${matchesStatus(status)}
   `;
 
     const totalPages = Math.ceil(Number(data[0].count) / ITEMS_PER_PAGE);
@@ -272,6 +297,8 @@ export async function fetchInvoiceDetail(id: string) {
         invoices.amount,
         invoices.status,
         invoices.date,
+        invoices.due_date,
+        ${isOverdue()} AS overdue,
         customers.id AS customer_id,
         customers.name,
         customers.email
diff --git a/app/lib/definitions.ts b/app/lib/definitions.ts
index d531d20..ef5139e 100644
--- a/app/lib/definitions.ts
+++ b/app/lib/definitions.ts
@@ -47,6 +47,8 @@ export type LatestInvoice = {
   amount: string;
   date: string;
   status: 'pending' | 'paid';
+  /** Pending and past its due date. */
+  overdue: boolean;
 };
 
 // The database returns a number for amount, but we later format it to a string with the formatCurrency function
@@ -63,6 +65,8 @@ export type InvoicesTable = {
   date: string;
   amount: number;
   status: 'pending' | 'paid';
+  /** Pending and past its due date. */
+  overdue: boolean;
 };
 
 export type CustomersTableType = {
@@ -110,6 +114,9 @@ export type InvoiceDetail = {
   amount: number;
   status: 'pending' | 'paid';
   date: string;
+  due_date: string;
+  /** Pending and past its due date. */
+  overdue: boolean;
   customer_id: string;
   name: string;
   email: string;
diff --git a/app/lib/placeholder-data.ts b/app/lib/placeholder-data.ts
index 257fb14..53fe991 100644
--- a/app/lib/placeholder-data.ts
+++ b/app/lib/placeholder-data.ts
@@ -54,78 +54,91 @@ const invoices = [
     amount: 15795,
     status: 'pending',
     date: '2022-12-06',
+    due_date: '2023-01-05',
   },
   {
     customer_id: customers[1].id,
     amount: 20348,
     status: 'pending',
     date: '2022-11-14',
+    due_date: '2022-12-14',
   },
   {
     customer_id: customers[4].id,
     amount: 3040,
     status: 'paid',
     date: '2022-10-29',
+    due_date: '2022-11-28',
   },
   {
     customer_id: customers[3].id,
     amount: 44800,
     status: 'paid',
     date: '2023-09-10',
+    due_date: '2023-10-10',
   },
   {
     customer_id: customers[5].id,
     amount: 34577,
     status: 'pending',
     date: '2023-08-05',
+    due_date: '2023-09-04',
   },
   {
     customer_id: customers[2].id,
     amount: 54246,
     status: 'pending',
     date: '2023-07-16',
+    due_date: '2023-08-15',
   },
   {
     customer_id: customers[0].id,
     amount: 666,
     status: 'pending',
     date: '2023-06-27',
+    due_date: '2023-07-27',
   },
   {
     customer_id: customers[3].id,
     amount: 32545,
     status: 'paid',
     date: '2023-06-09',
+    due_date: '2023-07-09',
   },
   {
     customer_id: customers[4].id,
     amount: 1250,
     status: 'paid',
     date: '2023-06-17',
+    due_date: '2023-07-17',
   },
   {
     customer_id: customers[5].id,
     amount: 8546,
     status: 'paid',
     date: '2023-06-07',
+    due_date: '2023-07-07',
   },
   {
     customer_id: customers[1].id,
     amount: 500,
     status: 'paid',
     date: '2023-08-19',
+    due_date: '2023-09-18',
   },
   {
     customer_id: customers[5].id,
     amount: 8945,
     status: 'paid',
     date: '2023-06-03',
+    due_date: '2023-07-03',
   },
   {
     customer_id: customers[2].id,
     amount: 1000,
     status: 'paid',
     date: '2022-06-05',
+    due_date: '2022-07-05',
   },
 ];
 
diff --git a/app/lib/schemas.ts b/app/lib/schemas.ts
index b21027a..29e3fe4 100644
--- a/app/lib/schemas.ts
+++ b/app/lib/schemas.ts
@@ -38,8 +38,11 @@ export const CustomerId = z.string().uuid();
 /** An invoice id from a URL or an action's argument, likewise. */
 export const InvoiceId = z.string().uuid();
 
-/** The invoice list's status filter, from the URL: anything unknown shows every status. */
-export const InvoiceStatusFilter = z.enum(['paid', 'pending']);
+/**
+ * The invoice list's status filter, from the URL: anything unknown shows every
+ * status. Pending means unpaid and not yet due; overdue, unpaid and past due.
+ */
+export const InvoiceStatusFilter = z.enum(['paid', 'pending', 'overdue']);
 export type InvoiceStatusFilter = z.infer<typeof InvoiceStatusFilter>;
 
 export const parseStatusFilter = (value: string | undefined): InvoiceStatusFilter | null =>
diff --git a/app/ui/dashboard/latest-invoices.tsx b/app/ui/dashboard/latest-invoices.tsx
index 98a7fdc..5d2363b 100644
--- a/app/ui/dashboard/latest-invoices.tsx
+++ b/app/ui/dashboard/latest-invoices.tsx
@@ -30,7 +30,7 @@ export default async function LatestInvoices() {
             <span className="hidden whitespace-nowrap sm:block">
               {formatDateToLocal(invoice.date)}
             </span>
-            <InvoiceStatus status={invoice.status} />
+            <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
             <span className="text-right">{invoice.amount}</span>
           </li>
         ))}
diff --git a/app/ui/invoices/status-filter.tsx b/app/ui/invoices/status-filter.tsx
index 77189cb..5642fa7 100644
--- a/app/ui/invoices/status-filter.tsx
+++ b/app/ui/invoices/status-filter.tsx
@@ -28,13 +28,14 @@ export default function StatusFilter() {
       </label>
       <select
         id="status-filter"
-        value={['paid', 'pending'].includes(current) ? current : ''}
+        value={['paid', 'pending', 'overdue'].includes(current) ? current : ''}
         onChange={(event) => choose(event.target.value)}
         className="block h-10 rounded-xl border border-line bg-panel py-2 pl-9 pr-8 text-sm text-white focus:border-aura focus:ring-aura"
       >
         <option value="">All statuses</option>
         <option value="paid">Paid</option>
         <option value="pending">Pending</option>
+        <option value="overdue">Overdue</option>
       </select>
       <FunnelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aura" />
     </div>
diff --git a/app/ui/invoices/status.tsx b/app/ui/invoices/status.tsx
index ac023eb..f2d3600 100644
--- a/app/ui/invoices/status.tsx
+++ b/app/ui/invoices/status.tsx
@@ -1,19 +1,32 @@
 import clsx from 'clsx';
 
-/** Paid: a lime outline pill. Pending: a filled violet pill. As in the mockup's invoice rows. */
-export default function InvoiceStatus({ status }: { status: string }) {
+/**
+ * Paid: a lime outline pill. Pending: a filled violet pill. As in the mockup's
+ * invoice rows. Overdue (pending, past its due date): a filled lime pill instead
+ * of Pending.
+ */
+export default function InvoiceStatus({
+  status,
+  overdue = false,
+}: {
+  status: string;
+  overdue?: boolean;
+}) {
+  const shown = status === 'pending' && overdue ? 'overdue' : status;
   return (
     <span
       className={clsx(
         'inline-flex min-w-[52px] items-center justify-center rounded-full border px-3 py-1 text-[12.7px]',
         {
-          'border-aura/60 bg-aura/25 text-white': status === 'pending',
-          'border-plasma/70 text-plasma': status === 'paid',
+          'border-aura/60 bg-aura/25 text-white': shown === 'pending',
+          'border-plasma/70 text-plasma': shown === 'paid',
+          'border-plasma bg-plasma font-medium text-void': shown === 'overdue',
         }
       )}
     >
-      {status === 'pending' ? 'Pending' : null}
-      {status === 'paid' ? 'Paid' : null}
+      {shown === 'pending' ? 'Pending' : null}
+      {shown === 'paid' ? 'Paid' : null}
+      {shown === 'overdue' ? 'Overdue' : null}
     </span>
   );
 }
diff --git a/app/ui/invoices/table.tsx b/app/ui/invoices/table.tsx
index 19334cb..9ce1ea0 100644
--- a/app/ui/invoices/table.tsx
+++ b/app/ui/invoices/table.tsx
@@ -35,7 +35,7 @@ export default async function InvoicesTable({
                     </div>
                     <p className="text-sm text-aura">{invoice.email}</p>
                   </div>
-                  <InvoiceStatus status={invoice.status} />
+                  <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
                 </div>
                 <div className="flex w-full items-center justify-between pt-4">
                   <div>
@@ -92,7 +92,7 @@ export default async function InvoicesTable({
                   <td className="whitespace-nowrap px-3 py-3">{formatCurrency(invoice.amount)}</td>
                   <td className="whitespace-nowrap px-3 py-3">{formatDateToLocal(invoice.date)}</td>
                   <td className="whitespace-nowrap px-3 py-3">
-                    <InvoiceStatus status={invoice.status} />
+                    <InvoiceStatus status={invoice.status} overdue={invoice.overdue} />
                   </td>
                   <td className="whitespace-nowrap py-3 pl-6 pr-3">
                     <div className="flex justify-end gap-3">
diff --git a/db/migrations/0003_invoice_due_dates.sql b/db/migrations/0003_invoice_due_dates.sql
new file mode 100644
index 0000000..0efc9f2
--- /dev/null
+++ b/db/migrations/0003_invoice_due_dates.sql
@@ -0,0 +1,14 @@
+-- Every invoice has a due date: 30 days after its date (the payment term the app
+-- sets when it creates one). An unpaid invoice past it is overdue; that is worked
+-- out when read, never stored. Written to apply to a database that already holds
+-- data: existing invoices get their date + 30, and nothing else changes.
+ALTER TABLE invoices ADD COLUMN due_date DATE;
+
+UPDATE invoices SET due_date = date + 30;
+
+-- The default keeps an insert that names no due date (the app before this
+-- migration) valid: it dates invoices today, so today + 30 is its date + 30.
+ALTER TABLE invoices
+  ALTER COLUMN due_date SET DEFAULT (CURRENT_DATE + 30),
+  ALTER COLUMN due_date SET NOT NULL,
+  ADD CONSTRAINT invoices_due_date_check CHECK (due_date >= date);
diff --git a/scripts/db.mjs b/scripts/db.mjs
index 42de455..949ffa3 100644
--- a/scripts/db.mjs
+++ b/scripts/db.mjs
@@ -84,8 +84,9 @@ async function seed(sql, schema) {
     if (count === 0) {
       for (const invoice of invoices) {
         await tx`
-          INSERT INTO invoices (customer_id, amount, status, date)
-          VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date})`;
+          INSERT INTO invoices (customer_id, amount, status, date, due_date)
+          VALUES (${invoice.customer_id}, ${invoice.amount}, ${invoice.status}, ${invoice.date},
+                  ${invoice.due_date})`;
       }
     }
     for (const row of revenue) {
diff --git a/tests/e2e/invoice-export.spec.ts b/tests/e2e/invoice-export.spec.ts
index 462cd6c..70d9524 100644
--- a/tests/e2e/invoice-export.spec.ts
+++ b/tests/e2e/invoice-export.spec.ts
@@ -47,10 +47,13 @@ test('the export is the filtered list as CSV, with formulas made harmless', asyn
   expect(download.suggestedFilename()).toBe('invoices.csv');
   const csv = readFileSync((await download.path())!, 'utf8').replace(/^\uFEFF/, '');
   const lines = csv.split('\r\n').filter(Boolean);
-  expect(lines[0]).toBe('Date,Customer,Email,Amount,Status');
-  // Only this customer's invoice, and the name can no longer run as a formula.
+  expect(lines[0]).toBe('Date,Due,Customer,Email,Amount,Status');
+  // Only this customer's invoice, due 30 days after today, and the name can no
+  // longer run as a formula.
+  const day = (offset: number) =>
+    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
   expect(lines.slice(1)).toEqual([
-    `${new Date().toISOString().slice(0, 10)},'${name},${tag}@example.com,12.34,pending`,
+    `${day(0)},${day(30)},'${name},${tag}@example.com,12.34,pending`,
   ]);
 });
 
diff --git a/tests/e2e/invoices-filter.spec.ts b/tests/e2e/invoices-filter.spec.ts
index 78b9239..1fb4bb9 100644
--- a/tests/e2e/invoices-filter.spec.ts
+++ b/tests/e2e/invoices-filter.spec.ts
@@ -21,21 +21,30 @@ const rowTexts = (page: Page) =>
 
 /**
  * Every row of the table (read at once: the list streams in anew after each URL
- * change) shows `status`, and the other status nowhere; and, if given, `text`.
+ * change) shows `status`, and the other statuses nowhere; and, if given, `text`.
  */
-async function expectEveryRow(page: Page, status: 'Paid' | 'Pending', text?: string) {
-  const other = status === 'Paid' ? 'Pending' : 'Paid';
+async function expectEveryRow(page: Page, status: Shown, text?: string) {
+  const others = SHOWN.filter((other) => other !== status);
   await expect
     .poll(async () => {
       const texts = await rows(page).evaluateAll((all) => all.map((row) => row.textContent ?? ''));
       return (
         texts.length > 0 &&
-        texts.every((t) => t.includes(status) && !t.includes(other) && (!text || t.includes(text)))
+        texts.every(
+          (t) =>
+            t.includes(status) &&
+            others.every((other) => !t.includes(other)) &&
+            (!text || t.includes(text))
+        )
       );
     })
     .toBe(true);
 }
 
+/** What a row's status pill can say: every invoice is exactly one of these. */
+const SHOWN = ['Paid', 'Pending', 'Overdue'] as const;
+type Shown = (typeof SHOWN)[number];
+
 test('the status filter lives in the URL, combines with search and survives pagination', async ({
   page,
 }) => {
@@ -62,28 +71,73 @@ test('the status filter lives in the URL, combines with search and survives pagi
   await expect(filter).toHaveValue('paid');
 
   // With a search: both apply, and the page goes back to 1. Balazs Orban has paid
-  // and pending invoices, so each filter shows only some of his.
+  // and unpaid invoices, the unpaid ones long past due (seeded in 2022-2023), so
+  // each filter shows only some of his.
   await page.getByPlaceholder('Search invoices...').fill('Balazs Orban');
   await expect(page).toHaveURL(/query=Balazs\+Orban/);
   await expect(page).toHaveURL(/page=1/);
   await expect(page).toHaveURL(/status=paid/);
   await expectEveryRow(page, 'Paid', 'Balazs Orban');
-  await filter.selectOption('pending');
-  await expect(page).toHaveURL(/status=pending/);
+  await filter.selectOption('overdue');
+  await expect(page).toHaveURL(/status=overdue/);
   await expect(page).toHaveURL(/query=Balazs\+Orban/);
-  await expectEveryRow(page, 'Pending', 'Balazs Orban');
+  await expectEveryRow(page, 'Overdue', 'Balazs Orban');
 
   // Every status again (the search still applies).
   await filter.selectOption('');
   await expect(page).not.toHaveURL(/status=/);
   await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
-  await expect(rows(page).filter({ hasText: 'Pending' }).first()).toBeVisible();
+  await expect(rows(page).filter({ hasText: 'Overdue' }).first()).toBeVisible();
 });
 
 test('an unknown status in the URL shows every invoice', async ({ page }) => {
   await logIn(page);
-  await page.goto('/dashboard/invoices?status=bogus');
+  // Searched, so invoices other tests add cannot push the seeded ones off page 1.
+  await page.goto('/dashboard/invoices?status=bogus&query=Balazs+Orban');
   await expect(page.getByLabel('Status')).toHaveValue('');
   await expect(rows(page).filter({ hasText: 'Paid' }).first()).toBeVisible();
-  await expect(rows(page).filter({ hasText: 'Pending' }).first()).toBeVisible();
+  await expect(rows(page).filter({ hasText: 'Overdue' }).first()).toBeVisible();
+});
+
+test('a new unpaid invoice is due in 30 days: pending, not overdue', async ({ page }) => {
+  test.setTimeout(60_000);
+  await logIn(page);
+  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
+  const name = `Due Date ${tag}`;
+
+  await page.goto('/dashboard/customers/create');
+  await page.waitForLoadState('networkidle');
+  await page.getByLabel('Name').fill(name);
+  await page.getByLabel('Email').fill(`${tag}@example.com`);
+  await page.getByRole('button', { name: 'Create Customer' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/customers$/, { timeout: 15_000 });
+
+  await page.goto('/dashboard/invoices/create');
+  await page.waitForLoadState('networkidle');
+  await page.getByLabel('Choose customer').selectOption({ label: name });
+  await page.getByLabel('Choose an amount').fill('40.00');
+  await page.getByLabel('Pending').check();
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+
+  // Listed as pending, under the pending filter and not under overdue.
+  await page.goto(`/dashboard/invoices?query=${tag}&status=pending`);
+  await expectEveryRow(page, 'Pending', name);
+  await page.goto(`/dashboard/invoices?query=${tag}&status=overdue`);
+  // A page load waits for the whole streamed list, so an empty table is final.
+  await expect(page.getByLabel('Status')).toHaveValue('overdue');
+  await expect(rows(page)).toHaveCount(0);
+
+  // The detail page gives its due date: 30 days after today.
+  await page.goto(`/dashboard/invoices?query=${tag}`);
+  await rows(page).first().getByRole('link', { name: /view/i }).click();
+  const due = new Date(Date.now() + 30 * 86_400_000);
+  const shown = due.toLocaleDateString('en-US', {
+    day: 'numeric',
+    month: 'short',
+    year: 'numeric',
+    timeZone: 'UTC',
+  });
+  await expect(page.getByText('Due', { exact: true })).toBeVisible();
+  await expect(page.getByText(shown)).toHaveCount(1);
 });
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index 0b5a04c..3fd8aba 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -85,7 +85,10 @@ describe('with a session', () => {
   it('createInvoice stores the amount in cents and redirects to the list', async () => {
     await createInvoice({}, invoiceForm());
     expect(sql).toHaveBeenCalledTimes(1);
-    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'paid', expect.any(String)]);
+    // Dated today, and due 30 days after that date (computed by the database).
+    const today = new Date().toISOString().slice(0, 10);
+    expect(sql.mock.calls[0].slice(1)).toEqual(['c0ffee', 1250, 'paid', today, today]);
+    expect(sql.mock.calls[0][0].join('?')).toContain('?, ?::date + 30)');
     expect(revalidatePath).toHaveBeenCalledWith('/dashboard/invoices');
     expect(redirect).toHaveBeenCalledWith('/dashboard/invoices');
   });
diff --git a/tests/unit/export-route.test.ts b/tests/unit/export-route.test.ts
index 7f7689f..c5dfb8a 100644
--- a/tests/unit/export-route.test.ts
+++ b/tests/unit/export-route.test.ts
@@ -6,8 +6,8 @@ const { auth, fetchInvoicesForExport } = vi.hoisted(() => ({
   fetchInvoicesForExport: vi.fn(),
 }));
 vi.mock('@/auth', () => ({ auth }));
-// A cap of 2 rows, so the over-the-cap case needs only three.
-vi.mock('@/app/lib/data', () => ({ EXPORT_LIMIT: 2, fetchInvoicesForExport }));
+// A cap of 3 rows, so the over-the-cap case needs only four.
+vi.mock('@/app/lib/data', () => ({ EXPORT_LIMIT: 3, fetchInvoicesForExport }));
 
 const { GET } = await import('@/app/dashboard/invoices/export/route');
 
@@ -16,14 +16,33 @@ const request = (search = '') => new Request(`http://localhost/dashboard/invoice
 beforeEach(() => {
   vi.clearAllMocks();
   fetchInvoicesForExport.mockResolvedValue([
+    {
+      date: '2023-07-01',
+      due_date: '2023-07-31',
+      name: 'Delba de Oliveira',
+      email: 'delba@oliveira.com',
+      amount: 120,
+      status: 'pending',
+      overdue: false,
+    },
     {
       date: '2023-06-27',
+      due_date: '2023-07-27',
       name: 'Evil Rabbit',
       email: 'evil@rabbit.com',
       amount: 66600,
       status: 'pending',
+      overdue: true,
+    },
+    {
+      date: '2023-06-09',
+      due_date: '2023-07-09',
+      name: '=HYPERLINK("x")',
+      email: 'a@b.c',
+      amount: 5,
+      status: 'paid',
+      overdue: false,
     },
-    { date: '2023-06-09', name: '=HYPERLINK("x")', email: 'a@b.c', amount: 5, status: 'paid' },
   ]);
 });
 
@@ -59,16 +78,18 @@ describe('with a session', () => {
     expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
     const body = await response.text();
     expect(body.split('\r\n')).toEqual([
-      'Date,Customer,Email,Amount,Status',
-      '2023-06-27,Evil Rabbit,evil@rabbit.com,666.00,pending',
-      `2023-06-09,"'=HYPERLINK(""x"")",a@b.c,0.05,paid`,
+      'Date,Due,Customer,Email,Amount,Status',
+      '2023-07-01,2023-07-31,Delba de Oliveira,delba@oliveira.com,1.20,pending',
+      // Pending past its due date: overdue, as the list shows it.
+      '2023-06-27,2023-07-27,Evil Rabbit,evil@rabbit.com,666.00,overdue',
+      `2023-06-09,2023-07-09,"'=HYPERLINK(""x"")",a@b.c,0.05,paid`,
       '',
     ]);
   });
 
   it('refuses rather than send a file that is cut short', async () => {
     fetchInvoicesForExport.mockResolvedValue(
-      [1, 2, 3].map((n) => ({
+      [1, 2, 3, 4].map((n) => ({
         date: '2023-01-0' + n,
         name: 'n',
         email: 'e',
diff --git a/tests/unit/schemas.test.ts b/tests/unit/schemas.test.ts
index 6dcbe98..4e2cd99 100644
--- a/tests/unit/schemas.test.ts
+++ b/tests/unit/schemas.test.ts
@@ -118,7 +118,8 @@ describe('parseStatusFilter', () => {
   it('keeps a known status and drops anything else', () => {
     expect(parseStatusFilter('paid')).toBe('paid');
     expect(parseStatusFilter('pending')).toBe('pending');
-    for (const value of [undefined, '', 'PAID', 'overdue', "paid' OR 1=1"]) {
+    expect(parseStatusFilter('overdue')).toBe('overdue');
+    for (const value of [undefined, '', 'PAID', 'Overdue', "paid' OR 1=1"]) {
       expect(parseStatusFilter(value)).toBeNull();
     }
   });
~~~~

</details>

#### T15 — `night-2026-10-01-t15-invoice-crud-e2e`

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

<details><summary>Code:  2 files changed, 148 insertions(+), 2 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index c1173dc..caabe58 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -110,7 +110,7 @@ jobs:
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
           tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
-          tests/e2e/invoice-export
+          tests/e2e/invoice-export tests/e2e/invoices
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -179,7 +179,7 @@ jobs:
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
           tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
-          tests/e2e/invoice-export
+          tests/e2e/invoice-export tests/e2e/invoices
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/tests/e2e/invoices.spec.ts b/tests/e2e/invoices.spec.ts
new file mode 100644
index 0000000..a46b01a
--- /dev/null
+++ b/tests/e2e/invoices.spec.ts
@@ -0,0 +1,146 @@
+import { type Page, expect, test } from '@playwright/test';
+
+// Invoice create, edit and delete through the forms, logged in as the demo user,
+// against the test schema global-setup.ts rebuilds. Each test makes its own
+// invoice, with an amount no other invoice has, and asserts only on it.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+async function logIn(page: Page) {
+  await page.goto('/login');
+  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Password', { exact: true }).fill('123456');
+  await page.getByRole('button', { name: /log in/i }).click();
+  await expect(page).toHaveURL(/\/dashboard$/);
+}
+
+/** An amount in cents that no seeded or other test's invoice has. */
+const uniqueCents = () => 1_000_000 + Math.floor(Math.random() * 8_999_999);
+
+const dollars = (cents: number) =>
+  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
+
+async function openCreateForm(page: Page) {
+  await page.goto('/dashboard/invoices/create');
+  // Filled before hydration, the form would be reset under the test's hands.
+  await page.waitForLoadState('networkidle');
+}
+
+/** Creates a pending invoice for Amy Burns for `cents`. */
+async function createInvoice(page: Page, cents: number) {
+  await openCreateForm(page);
+  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
+  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
+  await page.getByLabel('Pending').check();
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+}
+
+/** The invoice list's rows for that amount (the search matches cents). */
+async function rowsFor(page: Page, cents: number) {
+  await page.goto(`/dashboard/invoices?query=${cents}`);
+  return page.locator('table tbody tr').filter({ hasText: dollars(cents) });
+}
+
+test('an incomplete create form is refused with an error per field, and nothing is created', async ({
+  page,
+}) => {
+  await logIn(page);
+  await openCreateForm(page);
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+
+  // Each error is in the region its field names with aria-describedby.
+  await expect(page.locator('#customer-error')).toHaveText('Please select a customer.');
+  await expect(page.locator('#amount-error')).toHaveText('Please enter an amount greater than $0');
+  await expect(page.locator('#status-error')).toHaveText('Please select an invoice status.');
+  await expect(page.getByLabel('Choose an amount')).toHaveAttribute(
+    'aria-describedby',
+    'amount-error'
+  );
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/create$/);
+
+  // Valid but for the missing status: refused for that alone, and no invoice
+  // with that (unique) amount exists afterwards.
+  const cents = uniqueCents();
+  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
+  await page.getByLabel('Choose an amount').fill((cents / 100).toFixed(2));
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page.locator('#status-error')).toHaveText('Please select an invoice status.');
+  await expect(page.locator('#customer-error')).toBeEmpty();
+  await expect(page.locator('#amount-error')).toBeEmpty();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/create$/);
+  await expect(await rowsFor(page, cents)).toHaveCount(0);
+});
+
+test('an invoice is created and listed', async ({ page }) => {
+  test.setTimeout(60_000);
+  await logIn(page);
+  const cents = uniqueCents();
+  await openCreateForm(page);
+
+  // A zero amount is refused first; the other fields' choices are not errors.
+  await page.getByLabel('Choose customer').selectOption({ label: 'Amy Burns' });
+  await page.getByLabel('Choose an amount').fill('0');
+  await page.getByLabel('Paid').check();
+  await page.getByRole('button', { name: 'Create Invoice' }).click();
+  await expect(page.locator('#amount-error')).toHaveText('Please enter an amount greater than $0');
+  await expect(page.locator('#customer-error')).toBeEmpty();
+  await expect(page.locator('#status-error')).toBeEmpty();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/create$/);
+
+  await createInvoice(page, cents);
+  const row = await rowsFor(page, cents);
+  await expect(row).toHaveCount(1);
+  await expect(row).toContainText('Amy Burns');
+  await expect(row).toContainText('Pending');
+});
+
+test('an invoice is edited: a bad amount is refused, then the change is saved', async ({
+  page,
+}) => {
+  test.setTimeout(60_000);
+  await logIn(page);
+  const cents = uniqueCents();
+  await createInvoice(page, cents);
+
+  await (await rowsFor(page, cents)).getByRole('link', { name: 'Edit' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}\/edit$/);
+  await page.waitForLoadState('networkidle');
+  const amount = page.getByLabel('Choose an amount');
+  expect(Number(await amount.inputValue())).toBe(cents / 100);
+  const editUrl = page.url();
+
+  await amount.fill('-5');
+  await page.getByRole('button', { name: 'Edit Invoice' }).click();
+  await expect(page.locator('#amount-error')).toHaveText('Please enter an amount greater than $0');
+  await expect(page).toHaveURL(editUrl);
+
+  // Saved: a new amount and paid; the old amount is gone from the list.
+  const newCents = uniqueCents();
+  await amount.fill((newCents / 100).toFixed(2));
+  await page.getByLabel('Paid').check();
+  await page.getByRole('button', { name: 'Edit Invoice' }).click();
+  await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+  const row = await rowsFor(page, newCents);
+  await expect(row).toHaveCount(1);
+  await expect(row).toContainText('Amy Burns');
+  await expect(row).toContainText('Paid');
+  await expect(await rowsFor(page, cents)).toHaveCount(0);
+});
+
+test('an invoice is deleted, and stays deleted after a reload', async ({ page }) => {
+  test.setTimeout(60_000);
+  await logIn(page);
+  const cents = uniqueCents();
+  await createInvoice(page, cents);
+
+  const row = await rowsFor(page, cents);
+  await row
+    .getByRole('button', { name: `Delete invoice for Amy Burns, ${dollars(cents)}` })
+    .click();
+  await page.getByRole('dialog').getByRole('button', { name: 'Delete invoice' }).click();
+  await expect(page.getByRole('dialog')).toBeHidden();
+  await expect(row).toHaveCount(0);
+
+  // A fresh load of the list (a page load waits for the whole streamed table).
+  await expect(await rowsFor(page, cents)).toHaveCount(0);
+});
~~~~

</details>

#### Tc3 — `night-2026-10-01-c3-checkpoint`

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

<details><summary>Code:  6 files changed, 78 insertions(+), 4 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index caabe58..d386dbc 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -31,7 +31,7 @@ jobs:
         run: >-
           npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
           tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher tests/unit/seed-data
-          tests/unit/csv tests/unit/export-route
+          tests/unit/csv tests/unit/export-route tests/unit/invoice-status
       - name: Unit tests (cats, Node)
         if: ${{ !cancelled() }}
         run: >-
diff --git a/app/ui/invoices/delete-invoice.tsx b/app/ui/invoices/delete-invoice.tsx
index ef09678..0cffb13 100644
--- a/app/ui/invoices/delete-invoice.tsx
+++ b/app/ui/invoices/delete-invoice.tsx
@@ -1,6 +1,7 @@
 'use client';
 
 import { TrashIcon } from '@heroicons/react/20/solid';
+import { unstable_rethrow } from 'next/navigation';
 import { useId, useRef, useState, useTransition } from 'react';
 import { deleteInvoice, deleteInvoiceAndReturn } from '@/app/lib/actions';
 
@@ -37,7 +38,10 @@ export function DeleteInvoice({
       try {
         // From the detail page the action itself redirects to the list.
         await (fromDetailPage ? deleteInvoiceAndReturn : deleteInvoice)(id);
-      } catch {
+      } catch (error) {
+        // The detail page's redirect arrives here as a thrown error: let Next
+        // follow it rather than report a delete that succeeded as a failure.
+        unstable_rethrow(error);
         setError('The invoice could not be deleted. Please try again.');
         return;
       }
diff --git a/tests/e2e/invoice-detail.spec.ts b/tests/e2e/invoice-detail.spec.ts
index f4290a4..bc65a95 100644
--- a/tests/e2e/invoice-detail.spec.ts
+++ b/tests/e2e/invoice-detail.spec.ts
@@ -102,9 +102,24 @@ test('deleting from the detail page goes back to the list', async ({ page }) =>
   await row.getByRole('link', { name: /^View invoice/ }).click();
   await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
   const detail = page.url();
+  const pageErrors: Error[] = [];
+  page.on('pageerror', (error) => pageErrors.push(error));
+  // The action's redirect must not pass for a failure, even for a moment: note
+  // any "could not be deleted" text (the window survives the client navigation).
+  await page.evaluate(() => {
+    const seen = window as unknown as { sawDeleteError?: boolean };
+    new MutationObserver(() => {
+      if (document.body.textContent?.includes('could not be deleted')) seen.sawDeleteError = true;
+    }).observe(document.body, { subtree: true, childList: true, characterData: true });
+  });
   await page.getByRole('button', { name: /^Delete invoice for Amy Burns/ }).click();
   await page.getByRole('dialog').getByRole('button', { name: 'Delete invoice' }).click();
   await expect(page).toHaveURL(/\/dashboard\/invoices$/, { timeout: 15_000 });
+  await page.waitForLoadState('networkidle');
+  expect(
+    await page.evaluate(() => (window as unknown as { sawDeleteError?: boolean }).sawDeleteError)
+  ).toBeUndefined();
+  expect(pageErrors).toEqual([]);
   await page.goto(detail);
   await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
 });
diff --git a/tests/e2e/invoices-filter.spec.ts b/tests/e2e/invoices-filter.spec.ts
index 1fb4bb9..0592af5 100644
--- a/tests/e2e/invoices-filter.spec.ts
+++ b/tests/e2e/invoices-filter.spec.ts
@@ -60,13 +60,21 @@ test('the status filter lives in the URL, combines with search and survives pagi
   const firstPage = await rowTexts(page);
 
   // Eight seeded invoices are paid: two pages. Page 2 keeps the filter, and shows
-  // other paid invoices than page 1.
+  // other paid invoices than page 1. Some, not all: a test running alongside may
+  // mark a new invoice paid (dated today, it goes first), moving page 1's last
+  // row onto page 2 between the two reads.
   await page.getByRole('link', { name: '2', exact: true }).click();
   await expect(page).toHaveURL(/status=paid/);
   await expect(page).toHaveURL(/page=2/);
   await expectEveryRow(page, 'Paid');
   await expect
-    .poll(async () => (await rowTexts(page)).every((text) => !firstPage.includes(text)))
+    .poll(async () => {
+      const texts = await rowTexts(page);
+      return (
+        texts.every((text) => text.includes('Paid')) &&
+        texts.some((text) => !firstPage.includes(text))
+      );
+    })
     .toBe(true);
   await expect(filter).toHaveValue('paid');
 
@@ -83,6 +91,12 @@ test('the status filter lives in the URL, combines with search and survives pagi
   await expect(page).toHaveURL(/query=Balazs\+Orban/);
   await expectEveryRow(page, 'Overdue', 'Balazs Orban');
 
+  // Pending is unpaid and not yet due: none of his (no test adds invoices for
+  // him). Loaded afresh, since a page load waits for the whole streamed list.
+  await page.goto('/dashboard/invoices?query=Balazs+Orban&status=pending');
+  await expect(filter).toHaveValue('pending');
+  await expect(rows(page)).toHaveCount(0);
+
   // Every status again (the search still applies).
   await filter.selectOption('');
   await expect(page).not.toHaveURL(/status=/);
diff --git a/tests/unit/invoice-status.test.tsx b/tests/unit/invoice-status.test.tsx
new file mode 100644
index 0000000..8ae312b
--- /dev/null
+++ b/tests/unit/invoice-status.test.tsx
@@ -0,0 +1,21 @@
+import { renderToStaticMarkup } from 'react-dom/server';
+import { describe, expect, it } from 'vitest';
+import InvoiceStatus from '@/app/ui/invoices/status';
+
+// The status pill: each invoice shows exactly one of Paid, Pending and Overdue.
+const text = (element: React.ReactElement) => renderToStaticMarkup(element).replace(/<[^>]+>/g, '');
+
+describe('InvoiceStatus', () => {
+  it('says Pending for an unpaid invoice not yet due, and Paid for a paid one', () => {
+    expect(text(<InvoiceStatus status="pending" />)).toBe('Pending');
+    expect(text(<InvoiceStatus status="paid" />)).toBe('Paid');
+  });
+
+  it('says Overdue, instead of Pending, for an unpaid invoice past its due date', () => {
+    expect(text(<InvoiceStatus status="pending" overdue />)).toBe('Overdue');
+  });
+
+  it('never calls a paid invoice overdue', () => {
+    expect(text(<InvoiceStatus status="paid" overdue />)).toBe('Paid');
+  });
+});
diff --git a/tests/unit/seed-data.test.ts b/tests/unit/seed-data.test.ts
index 13b5b59..6d2fdcb 100644
--- a/tests/unit/seed-data.test.ts
+++ b/tests/unit/seed-data.test.ts
@@ -10,6 +10,14 @@ describe('the seed data', () => {
     for (const invoice of invoices) expect(ids.has(invoice.customer_id)).toBe(true);
   });
 
+  it('gives every invoice a due date 30 days after its date (invoices_due_date_check)', () => {
+    for (const invoice of invoices) {
+      const due = new Date(`${invoice.date}T00:00:00Z`);
+      due.setUTCDate(due.getUTCDate() + 30);
+      expect(invoice.due_date, invoice.date).toBe(due.toISOString().slice(0, 10));
+    }
+  });
+
   it('has unique customer ids', () => {
     expect(new Set(customers.map((customer) => customer.id)).size).toBe(customers.length);
   });
@@ -30,4 +38,16 @@ describe('the migrations', () => {
     expect(body).toMatch(/REFERENCES customers \(id\) ON DELETE RESTRICT/);
     expect(body).not.toMatch(/\bDROP\b/i);
   });
+
+  it('give existing invoices a due date before requiring one, and drop nothing', () => {
+    const body = readFileSync(new URL('0003_invoice_due_dates.sql', dir), 'utf8');
+    const add = body.indexOf('ADD COLUMN due_date DATE;');
+    const fill = body.indexOf('UPDATE invoices SET due_date = date + 30;');
+    const required = body.indexOf('SET NOT NULL');
+    expect(add).toBeGreaterThan(-1);
+    expect(fill).toBeGreaterThan(add);
+    expect(required).toBeGreaterThan(fill);
+    expect(body).toMatch(/CHECK \(due_date >= date\)/);
+    expect(body).not.toMatch(/\bDROP\b/i);
+  });
 });
~~~~

</details>

#### T16 — `night-2026-10-01-t16-db-tests`

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

<details><summary>Code:  5 files changed, 376 insertions(+), 5 deletions(-)</summary>

~~~~diff
diff --git a/.claude/rules/database.md b/.claude/rules/database.md
index ac73735..2cf2132 100644
--- a/.claude/rules/database.md
+++ b/.claude/rules/database.md
@@ -9,8 +9,9 @@ Open this for schema, migration, and persistence work. Database changes are high
 - **A development database, no production one yet.** `POSTGRES_URL` in `.env`
   points at a PostgreSQL on the local network whose data has no value. The app
   uses the schema the URL names in `?search_path=` (`xenocats`); the browser
-  tests use `xenocats_test`, which they drop and rebuild on every run. Writing
-  to either is ordinary development. The role cannot create tables in `public`.
+  tests use `xenocats_test`, which they drop and rebuild on every run, and the
+  database unit tests (`tests/unit/data.test.ts`) `xenocats_vitest`. Writing
+  to any of them is ordinary development. The role cannot create tables in `public`.
 - **Migrations** are numbered SQL files in `db/migrations/` (`0002_<what>.sql`
   next), applied in name order by `npm run db:migrate`, each in a transaction,
   and recorded in the schema's `schema_migrations` table. A schema change is a
diff --git a/.claude/rules/testing.md b/.claude/rules/testing.md
index 10aec68..301fb4f 100644
--- a/.claude/rules/testing.md
+++ b/.claude/rules/testing.md
@@ -15,7 +15,10 @@ one schema: a test that writes creates its own rows and asserts only on them,
 never on counts or on seed rows another test may change. Tests that need the
 database skip when no `POSTGRES_URL` is configured, or with `E2E_NO_DATABASE=1`
 (the server is unreachable). The schema is shared: two machines running the
-suite at once drop it under each other.
+suite at once drop it under each other. The queries in `app/lib/data.ts` are
+tested in Vitest by `tests/unit/data.test.ts`, against its own schema
+(`xenocats_vitest`, rebuilt when the file runs), so they never meet the browser
+tests' rows; it skips the same way.
 
 ---
 
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index d386dbc..465b32a 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -97,7 +97,8 @@ jobs:
           sudo systemctl start postgresql.service
           sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres'"
           test "$(sudo -u postgres psql -Atc 'SHOW ssl')" = on
-      - run: npm run db:migrate && npm run db:seed
+      - id: database
+        run: npm run db:migrate && npm run db:seed
       - run: npm run build
       - id: install
         run: npx playwright install --with-deps chromium
@@ -135,6 +136,12 @@ jobs:
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/sound
+      # Only this job has a database for them (the checks job skips this file),
+      # whether or not the build and browser tests passed. The tests rebuild
+      # their own schema, xenocats_vitest, on this job's server.
+      - name: Database tests
+        if: ${{ !cancelled() && steps.database.outcome == 'success' }}
+        run: npx vitest run tests/unit/data
       - uses: actions/upload-artifact@v4
         if: failure()
         with:
diff --git a/CLAUDE.md b/CLAUDE.md
index 55d2e99..996c1da 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -268,6 +268,12 @@ instead, which needs an existing `npm run build`. `next dev` also (re-)adds a Ne
 to `AGENTS.md` when it detects an AI agent, and flips `next-env.d.ts` between
 its dev and build variants; neither is part of a task's change.
 
+`npm test` includes `tests/unit/data.test.ts`, which runs every query in
+`app/lib/data.ts` against a real database: it drops and rebuilds its own
+`xenocats_vitest` schema (and a scratch `xenocats_vitest_migrations`) on the
+server `POSTGRES_URL` names, and skips like the browser tests do — no URL, or
+`E2E_NO_DATABASE=1`. In CI it runs in the *build* job, which has a database.
+
 `lint` exits non-zero on **errors only**; warnings print without failing, so a
 clean exit does not mean an empty report. Read the output; do not report "lint
 passed" as though it found nothing.
@@ -280,7 +286,8 @@ the task changed.
 The running app, and possibly `npm run build` where a page prerenders, need
 `POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` in `.env`. **`POSTGRES_URL` is a
 development database** on the local network, holding no data of value: the app
-uses its `xenocats` schema, the browser tests `xenocats_test`. The URL carries
+uses its `xenocats` schema, the browser tests `xenocats_test`, the database unit
+tests `xenocats_vitest`. The URL carries
 the schema as `?search_path=`. The schema is defined by `db/migrations/*.sql`;
 `npm run db:migrate` applies new ones, `db:seed` loads
 `app/lib/placeholder-data.ts`, and `db:reset` rebuilds a schema from scratch.
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
new file mode 100644
index 0000000..5a48b86
--- /dev/null
+++ b/tests/unit/data.test.ts
@@ -0,0 +1,353 @@
+import { execFileSync } from 'node:child_process';
+import { readFileSync } from 'node:fs';
+import { parseEnv } from 'node:util';
+import postgres from 'postgres';
+import { afterAll, beforeAll, describe, expect, it } from 'vitest';
+import { percentChange } from '@/app/lib/dashboard';
+import { customers, invoices } from '@/app/lib/placeholder-data';
+import { formatCurrency } from '@/app/lib/utils';
+
+// Every query in app/lib/data.ts against a real database: its own schema,
+// `xenocats_vitest`, on the server POSTGRES_URL names (the environment's, else
+// .env's), rebuilt from db/migrations and the seed before this file runs. The
+// browser tests use `xenocats_test`, so the two suites never meet. Like them,
+// these skip without a URL, or with E2E_NO_DATABASE=1 (the server is unreachable).
+// The expected values are worked out from the seed (placeholder-data.ts).
+
+function databaseUrl(schema: string): string | null {
+  if (process.env.E2E_NO_DATABASE) return null;
+  let base = process.env.POSTGRES_URL;
+  if (!base) {
+    try {
+      // Read, not loaded: this process's own environment stays as it was.
+      base = (parseEnv(readFileSync('.env', 'utf8')) as NodeJS.Dict<string>).POSTGRES_URL;
+    } catch {
+      // No .env: only the environment counts.
+    }
+  }
+  if (!base) return null;
+  const url = new URL(base);
+  url.searchParams.set('search_path', schema);
+  return url.toString();
+}
+
+const url = databaseUrl('xenocats_vitest');
+
+/** 'YYYY-MM-DD' for a DATE column, which postgres.js reads as a UTC-midnight Date. */
+const day = (value: unknown) => new Date(value as string).toISOString().slice(0, 10);
+const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);
+const paid = invoices.filter((invoice) => invoice.status === 'paid');
+const pending = invoices.filter((invoice) => invoice.status === 'pending');
+const newestFirst = [...invoices].sort((a, b) => b.date.localeCompare(a.date));
+const customerOf = (invoice: (typeof invoices)[number]) =>
+  customers.find((customer) => customer.id === invoice.customer_id)!;
+// Every seeded invoice is from 2022–2023: every unpaid one is past its due date.
+const today = new Date().toISOString().slice(0, 10);
+const addDays = (date: string, days: number) =>
+  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
+
+describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
+  let data: typeof import('@/app/lib/data');
+
+  beforeAll(async () => {
+    execFileSync(
+      process.execPath,
+      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/db.mjs', 'reset'],
+      { env: { ...process.env, POSTGRES_URL: url! }, stdio: 'pipe' }
+    );
+    // data.ts connects to POSTGRES_URL when it is first imported.
+    process.env.POSTGRES_URL = url!;
+    data = await import('@/app/lib/data');
+  }, 60_000);
+
+  describe('on the seed alone', () => {
+    it('fetchLatestInvoices: the five newest, formatted, overdue when unpaid and past due', async () => {
+      const latest = await data.fetchLatestInvoices();
+      expect(latest.map((row) => day(row.date))).toEqual(
+        newestFirst.slice(0, 5).map((invoice) => invoice.date)
+      );
+      for (const [i, row] of latest.entries()) {
+        const seeded = newestFirst[i];
+        expect(row.amount).toBe(formatCurrency(seeded.amount));
+        expect(row.name).toBe(customerOf(seeded).name);
+        expect(row.overdue).toBe(seeded.status === 'pending');
+      }
+    });
+
+    it('fetchCardData, all time: every invoice, and every customer', async () => {
+      const cards = await data.fetchCardData('all');
+      expect(cards.collected).toEqual({ value: sum(paid), change: null });
+      expect(cards.pending).toEqual({ value: sum(pending), change: null });
+      expect(cards.invoices).toEqual({ value: invoices.length, change: null });
+      expect(cards.customers).toEqual({ value: customers.length, change: null });
+    });
+
+    it('fetchCardData, last 12 months: from the month 11 back, compared with the 12 before', async () => {
+      // As if it were mid-December 2023: 2023 is the period, 2022 the one before.
+      const cards = await data.fetchCardData('12m', new Date('2023-12-15T12:00:00Z'));
+      const in2023 = invoices.filter((invoice) => invoice.date.startsWith('2023'));
+      const in2022 = invoices.filter((invoice) => invoice.date.startsWith('2022'));
+      const paidIn = (rows: typeof invoices) => sum(rows.filter((r) => r.status === 'paid'));
+      const customersIn = (rows: typeof invoices) => new Set(rows.map((r) => r.customer_id)).size;
+      expect(cards.collected).toEqual({
+        value: paidIn(in2023),
+        change: percentChange(paidIn(in2023), paidIn(in2022)),
+      });
+      expect(cards.invoices).toEqual({
+        value: in2023.length,
+        change: percentChange(in2023.length, in2022.length),
+      });
+      expect(cards.customers.value).toBe(customersIn(in2023));
+    });
+
+    it('fetchMonthlyTotals: twelve months for 12m (empty ones as zero), months with invoices for all', async () => {
+      const months = await data.fetchMonthlyTotals('12m', new Date('2023-12-15T12:00:00Z'));
+      expect(months.map((m) => m.month)).toEqual(
+        Array.from({ length: 12 }, (_, i) => `2023-${String(i + 1).padStart(2, '0')}`)
+      );
+      const june = invoices.filter((invoice) => invoice.date.startsWith('2023-06'));
+      expect(months.find((m) => m.month === '2023-06')).toEqual({
+        month: '2023-06',
+        paid: sum(june.filter((r) => r.status === 'paid')),
+        pending: sum(june.filter((r) => r.status === 'pending')),
+      });
+      expect(months.find((m) => m.month === '2023-01')).toEqual({
+        month: '2023-01',
+        paid: 0,
+        pending: 0,
+      });
+
+      const all = await data.fetchMonthlyTotals('all');
+      expect(all.map((m) => m.month)).toEqual(
+        [...new Set(invoices.map((invoice) => invoice.date.slice(0, 7)))].sort()
+      );
+    });
+
+    it('fetchFilteredInvoices and fetchInvoicesPages: six a page, newest first', async () => {
+      const first = await data.fetchFilteredInvoices('', 1);
+      expect(first.map((row) => day(row.date))).toEqual(
+        newestFirst.slice(0, 6).map((invoice) => invoice.date)
+      );
+      const last = await data.fetchFilteredInvoices('', 3);
+      expect(last).toHaveLength(invoices.length - 12);
+      expect(await data.fetchInvoicesPages('')).toBe(Math.ceil(invoices.length / 6));
+    });
+
+    it('fetchFilteredInvoices: the search matches name, email, amount, date and status, any case', async () => {
+      const balazs = customers.find((customer) => customer.name === 'Balazs Orban')!;
+      const his = invoices.filter((invoice) => invoice.customer_id === balazs.id);
+      for (const query of ['balazs orban', 'BALAZS@ORBAN.COM']) {
+        const rows = await data.fetchFilteredInvoices(query, 1);
+        expect(rows.map((row) => row.name)).toEqual(his.map(() => 'Balazs Orban'));
+      }
+      expect((await data.fetchFilteredInvoices('44800', 1)).map((row) => row.amount)).toEqual([
+        44800,
+      ]);
+      expect(
+        (await data.fetchFilteredInvoices('2022-11-14', 1)).map((row) => day(row.date))
+      ).toEqual(['2022-11-14']);
+      // Eight seeded invoices are paid: a full first page, and two pages.
+      expect(await data.fetchFilteredInvoices('PAID', 1)).toHaveLength(Math.min(6, paid.length));
+      expect(await data.fetchInvoicesPages('PAID')).toBe(Math.ceil(paid.length / 6));
+      expect(await data.fetchFilteredInvoices('no such invoice', 1)).toEqual([]);
+      expect(await data.fetchInvoicesPages('no such invoice')).toBe(0);
+      // A query is a value, never SQL.
+      expect(await data.fetchFilteredInvoices("' OR 1=1 --", 1)).toEqual([]);
+    });
+
+    it('the status filter: paid, pending (not yet due) and overdue are disjoint', async () => {
+      const ofStatus = async (status: 'paid' | 'pending' | 'overdue') => {
+        const rows = [];
+        for (let page = 1; page <= (await data.fetchInvoicesPages('', status)); page++) {
+          rows.push(...(await data.fetchFilteredInvoices('', page, status)));
+        }
+        return rows;
+      };
+      const paidRows = await ofStatus('paid');
+      expect(paidRows).toHaveLength(paid.length);
+      expect(paidRows.every((row) => row.status === 'paid' && !row.overdue)).toBe(true);
+      const overdueRows = await ofStatus('overdue');
+      expect(overdueRows).toHaveLength(pending.length);
+      expect(overdueRows.every((row) => row.status === 'pending' && row.overdue)).toBe(true);
+      expect(await ofStatus('pending')).toEqual([]);
+      expect(await data.fetchInvoicesPages('', 'paid')).toBe(Math.ceil(paid.length / 6));
+
+      // Combined with a search, both must match.
+      const balazsPaid = await data.fetchFilteredInvoices('Balazs', 1, 'paid');
+      expect(balazsPaid.length).toBeGreaterThan(0);
+      expect(balazsPaid.every((row) => row.name === 'Balazs Orban' && row.status === 'paid')).toBe(
+        true
+      );
+    });
+
+    it('fetchInvoicesForExport: every match, dates as text, overdue marked', async () => {
+      const rows = await data.fetchInvoicesForExport('', null);
+      expect(rows.map((row) => row.date)).toEqual(newestFirst.map((invoice) => invoice.date));
+      expect(rows.map((row) => row.due_date)).toEqual(
+        newestFirst.map((invoice) => invoice.due_date)
+      );
+      expect(rows.map((row) => row.overdue)).toEqual(
+        newestFirst.map((invoice) => invoice.status === 'pending')
+      );
+      expect(await data.fetchInvoicesForExport('Balazs', 'overdue')).toHaveLength(
+        pending.filter((invoice) => customerOf(invoice).name === 'Balazs Orban').length
+      );
+    });
+
+    it('fetchInvoiceById and fetchInvoiceDetail: one invoice, or nothing', async () => {
+      const [row] = await data.fetchFilteredInvoices('44800', 1);
+      const form = await data.fetchInvoiceById(row.id);
+      const seeded = invoices.find((invoice) => invoice.amount === 44800)!;
+      // The edit form takes dollars.
+      expect(form).toEqual({
+        id: row.id,
+        customer_id: seeded.customer_id.toLowerCase(),
+        amount: 448,
+        status: 'paid',
+      });
+
+      const detail = await data.fetchInvoiceDetail(row.id);
+      expect(detail).toMatchObject({
+        id: row.id,
+        amount: 44800,
+        status: 'paid',
+        overdue: false,
+        name: customerOf(seeded).name,
+        email: customerOf(seeded).email,
+      });
+      expect(day(detail!.date)).toBe(seeded.date);
+      expect(day(detail!.due_date)).toBe(seeded.due_date);
+
+      const nobody = '00000000-0000-4000-8000-000000000000';
+      expect(await data.fetchInvoiceById(nobody)).toBeUndefined();
+      expect(await data.fetchInvoiceDetail(nobody)).toBeUndefined();
+    });
+
+    it('fetchCustomers and fetchCustomerById', async () => {
+      const all = await data.fetchCustomers();
+      expect(all.map((customer) => customer.name)).toEqual(
+        customers.map((customer) => customer.name).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
+      );
+      const amy = all.find((customer) => customer.name === 'Amy Burns')!;
+      expect(await data.fetchCustomerById(amy.id)).toEqual({
+        id: amy.id,
+        name: 'Amy Burns',
+        email: 'amy@burns.com',
+      });
+      expect(await data.fetchCustomerById('00000000-0000-4000-8000-000000000000')).toBeUndefined();
+    });
+
+    it('fetchFilteredCustomers: each customer with their invoice count and totals', async () => {
+      const rows = await data.fetchFilteredCustomers('');
+      expect(rows).toHaveLength(customers.length);
+      for (const customer of customers) {
+        const theirs = invoices.filter((invoice) => invoice.customer_id === customer.id);
+        const row = rows.find((r) => r.name === customer.name)!;
+        expect(Number(row.total_invoices)).toBe(theirs.length);
+        expect(row.total_paid).toBe(formatCurrency(sum(theirs.filter((r) => r.status === 'paid'))));
+        expect(row.total_pending).toBe(
+          formatCurrency(sum(theirs.filter((r) => r.status === 'pending')))
+        );
+      }
+      expect((await data.fetchFilteredCustomers('ROBINSON')).map((r) => r.name)).toEqual([
+        'Lee Robinson',
+      ]);
+      expect(await data.fetchFilteredCustomers('no such customer')).toEqual([]);
+    });
+  });
+
+  // Last, since it adds rows: a customer of its own, with one invoice not yet due
+  // and one past due, so pending and overdue both have a member.
+  describe('with invoices of its own', () => {
+    let sql: postgres.Sql;
+    const tag = `vitest${Date.now().toString(36)}`;
+
+    beforeAll(async () => {
+      sql = postgres(url!, { ssl: 'require', max: 1, onnotice: () => {} });
+      const [{ id }] = await sql`
+        INSERT INTO customers (name, email, image_url)
+        VALUES (${tag}, ${`${tag}@example.com`}, '/customers/amy-burns.png')
+        RETURNING id`;
+      await sql`
+        INSERT INTO invoices (customer_id, amount, status, date, due_date) VALUES
+          (${id}, 1111, 'pending', ${today}, ${addDays(today, 30)}),
+          (${id}, 2222, 'pending', ${addDays(today, -40)}, ${addDays(today, -10)})`;
+    });
+
+    afterAll(async () => {
+      await sql`DELETE FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE name = ${tag})`;
+      await sql`DELETE FROM customers WHERE name = ${tag}`;
+      await sql.end();
+    });
+
+    it('an unpaid invoice is pending until its due date, then overdue', async () => {
+      const byStatus = async (status: 'pending' | 'overdue') =>
+        (await data.fetchFilteredInvoices(tag, 1, status)).map((row) => row.amount);
+      expect(await byStatus('pending')).toEqual([1111]);
+      expect(await byStatus('overdue')).toEqual([2222]);
+      const all = await data.fetchFilteredInvoices(tag, 1);
+      expect(all.map((row) => [row.amount, row.overdue])).toEqual([
+        [1111, false],
+        [2222, true],
+      ]);
+      expect((await data.fetchInvoicesForExport(tag, 'pending')).map((r) => r.amount)).toEqual([
+        1111,
+      ]);
+      expect(await data.fetchInvoicesPages(tag, 'overdue')).toBe(1);
+    });
+  });
+});
+
+// Migration 0003 on a table that already holds invoices: applied after 0001 and
+// 0002 to rows written without a due date. Its own schema, dropped afterwards.
+describe.skipIf(!url)('migration 0003 on existing invoices', () => {
+  const migrationsUrl = databaseUrl('xenocats_vitest_migrations')!;
+  let sql: postgres.Sql;
+  const migration = (name: string) =>
+    readFileSync(new URL(`../../db/migrations/${name}`, import.meta.url), 'utf8');
+
+  beforeAll(async () => {
+    sql = postgres(migrationsUrl, { ssl: 'require', max: 1, onnotice: () => {} });
+    await sql`DROP SCHEMA IF EXISTS xenocats_vitest_migrations CASCADE`;
+    await sql`CREATE SCHEMA xenocats_vitest_migrations`;
+  });
+
+  afterAll(async () => {
+    await sql`DROP SCHEMA IF EXISTS xenocats_vitest_migrations CASCADE`;
+    await sql.end();
+  });
+
+  it('gives each existing invoice its date + 30, then requires a due date not before it', async () => {
+    // Repository files, not input: unsafe() runs a multi-statement script.
+    await sql.unsafe(migration('0001_init.sql'));
+    await sql.unsafe(migration('0002_invoice_keys_and_indexes.sql'));
+    const [{ id }] = await sql`
+      INSERT INTO customers (name, email, image_url) VALUES ('Old', 'old@example.com', '/x.png')
+      RETURNING id`;
+    await sql`
+      INSERT INTO invoices (customer_id, amount, status, date) VALUES
+        (${id}, 100, 'paid', '2023-01-31'), (${id}, 200, 'pending', '2024-02-15')`;
+
+    await sql.unsafe(migration('0003_invoice_due_dates.sql'));
+
+    const rows = await sql`
+      SELECT to_char(date, 'YYYY-MM-DD') AS date, to_char(due_date, 'YYYY-MM-DD') AS due
+      FROM invoices ORDER BY date`;
+    expect(rows.map((row) => [row.date, row.due])).toEqual([
+      ['2023-01-31', '2023-03-02'],
+      ['2024-02-15', '2024-03-16'],
+    ]);
+
+    // The app before the migration names no due date: today + 30.
+    const [inserted] = await sql`
+      INSERT INTO invoices (customer_id, amount, status, date)
+      VALUES (${id}, 300, 'pending', CURRENT_DATE)
+      RETURNING (due_date - date) AS days`;
+    expect(inserted.days).toBe(30);
+
+    await expect(
+      sql`INSERT INTO invoices (customer_id, amount, status, date, due_date)
+          VALUES (${id}, 400, 'pending', '2024-01-10', '2024-01-09')`
+    ).rejects.toThrow(/invoices_due_date_check/);
+  });
+});
~~~~

</details>

#### T17 — `night-2026-10-01-t17-login-rate-limit`

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

<details><summary>Code:  13 files changed, 399 insertions(+), 22 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 465b32a..c5e60a2 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -32,6 +32,7 @@ jobs:
           npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
           tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher tests/unit/seed-data
           tests/unit/csv tests/unit/export-route tests/unit/invoice-status
+          tests/unit/login-limit
       - name: Unit tests (cats, Node)
         if: ${{ !cancelled() }}
         run: >-
@@ -106,16 +107,31 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard, customers, invoices)
+      - name: Browser tests against next start (smoke, branding, dashboard, login)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
-          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
-          tests/e2e/invoice-export tests/e2e/invoices
+          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           --output test-results/smoke
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
+      - name: Browser tests against next start (customers)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/customers
+          --output test-results/customers
+        env:
+          E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/customers
+      - name: Browser tests against next start (invoices)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/invoices-filter tests/e2e/invoice-detail tests/e2e/invoice-export
+          tests/e2e/invoices
+          --output test-results/invoices
+        env:
+          E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/invoices
       - name: Browser tests against next start (cats, petting, touch)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: npx playwright test tests/e2e/cats tests/e2e/pet-cat tests/e2e/touch --output test-results/cats
@@ -181,15 +197,28 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard, customers, invoices)
+      - name: Browser tests (smoke, branding, dashboard, login)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
-          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
-          tests/e2e/invoice-export tests/e2e/invoices
+          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
+      - name: Browser tests (customers)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/customers
+          --output test-results/customers
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/customers
+      - name: Browser tests (invoices)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/invoices-filter tests/e2e/invoice-detail tests/e2e/invoice-export
+          tests/e2e/invoices
+          --output test-results/invoices
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/invoices
       - name: Browser tests (cats, petting, touch)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: npx playwright test tests/e2e/cats tests/e2e/pet-cat tests/e2e/touch --output test-results/cats
diff --git a/README.md b/README.md
index 72e48f6..eec3b76 100644
--- a/README.md
+++ b/README.md
@@ -15,8 +15,10 @@ npm ci
 npm run dev
 ```
 
-The app reads `POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` from `.env`. The
-checks (lint, type check, unit and browser tests, build) are listed in
+The app reads `POSTGRES_URL`, `AUTH_SECRET` and `AUTH_URL` from `.env`, and
+optionally `LOGIN_MAX_FAILURES` and `LOGIN_LOCK_MINUTES`: after that many
+failed logins in a row an email is refused for that many minutes (default 5
+and 15). The checks (lint, type check, unit and browser tests, build) are listed in
 `CLAUDE.md` §9.
 
 ## Design
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index 40e764d..a6776cf 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -4,7 +4,8 @@ import { revalidatePath } from 'next/cache';
 import { redirect } from 'next/navigation';
 import postgres from 'postgres';
 import { auth, signIn } from '@/auth';
-import { AuthError } from 'next-auth';
+import { AuthError, type CredentialsSignin } from 'next-auth';
+import { LOCKED } from '@/app/lib/login-limit';
 import {
   CreateInvoice,
   CustomerForm,
@@ -269,6 +270,10 @@ export async function authenticate(prevState: string | undefined, formData: Form
     if (error instanceof AuthError) {
       switch (error.type) {
         case 'CredentialsSignin':
+          if ((error as CredentialsSignin).code === LOCKED) {
+            // Not how long: the time left differs from lock to lock.
+            return 'Too many failed logins for this email. Try again later.';
+          }
           return 'Invalid credentials.';
         default:
           return 'Something went wrong.';
diff --git a/app/lib/login-limit.ts b/app/lib/login-limit.ts
new file mode 100644
index 0000000..52948c3
--- /dev/null
+++ b/app/lib/login-limit.ts
@@ -0,0 +1,71 @@
+import type { Sql } from 'postgres';
+
+// The login lockout: after `maxFailures` failed logins in a row for one email,
+// that email is refused for `lockMinutes` minutes, right password or not. Counted
+// per email whether or not a user has it, so it reveals nothing about which
+// emails exist. Stored in `login_failures` (db/migrations/0004).
+//
+// Every attempt is counted *before* its password is compared, in one statement,
+// so concurrent attempts cannot all slip past the check: each gets its own
+// number, and only numbers 1..N are compared. The Nth sets the lock as it is
+// counted. A success deletes the email's row, lock included; a lock that has run
+// out starts the count again from 1.
+
+/** The `code` of the error a locked-out login fails with (auth.ts, actions.ts). */
+export const LOCKED = 'locked';
+
+/**
+ * N and M, from the environment (LOGIN_MAX_FAILURES, LOGIN_LOCK_MINUTES), each
+ * a whole number above zero; anything else falls back to 5 failures, 15 minutes.
+ */
+export function loginLimits(env: Record<string, string | undefined> = process.env) {
+  return {
+    maxFailures: positiveInteger(env.LOGIN_MAX_FAILURES, 5),
+    lockMinutes: positiveInteger(env.LOGIN_LOCK_MINUTES, 15),
+  };
+}
+
+function positiveInteger(value: string | undefined, fallback: number) {
+  const number = Number(value);
+  return value && Number.isInteger(number) && number > 0 ? number : fallback;
+}
+
+/** The key an email is counted under: as typed, trimmed and lower-cased. */
+export const loginKey = (email: string) => email.trim().toLowerCase();
+
+/**
+ * Counts an attempt for the email and says whether its password may be
+ * compared: only while the email is not locked, and only for the first N
+ * attempts since the last success or lockout.
+ */
+export async function claimAttempt(
+  sql: Sql,
+  key: string,
+  { maxFailures, lockMinutes }: ReturnType<typeof loginLimits>
+): Promise<boolean> {
+  const [{ attempt }] = await sql<{ attempt: number }[]>`
+    INSERT INTO login_failures AS f (email, failures, locked_until)
+    VALUES (
+      ${key},
+      1,
+      CASE WHEN 1 >= ${maxFailures} THEN now() + make_interval(mins => ${lockMinutes}) END
+    )
+    ON CONFLICT (email) DO UPDATE SET
+      -- A lock that has run out starts the count again; otherwise one more.
+      failures = CASE
+        WHEN f.locked_until <= now() THEN 1
+        ELSE f.failures + 1
+      END,
+      locked_until = CASE
+        WHEN f.locked_until > now() THEN f.locked_until
+        WHEN (CASE WHEN f.locked_until <= now() THEN 1 ELSE f.failures + 1 END) >= ${maxFailures}
+          THEN now() + make_interval(mins => ${lockMinutes})
+      END
+    RETURNING failures AS attempt`;
+  return attempt <= maxFailures;
+}
+
+/** Forgets the email's attempts (and any lock they set), after a successful login. */
+export async function clearFailures(sql: Sql, key: string) {
+  await sql`DELETE FROM login_failures WHERE email = ${key}`;
+}
diff --git a/auth.ts b/auth.ts
index 60d4f4f..fb08067 100644
--- a/auth.ts
+++ b/auth.ts
@@ -1,11 +1,17 @@
-import NextAuth from 'next-auth';
+import NextAuth, { CredentialsSignin } from 'next-auth';
 import Credentials from 'next-auth/providers/credentials';
 import { authConfig } from './auth.config';
 import { z } from 'zod';
 import type { User } from '@/app/lib/definitions';
+import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
 import bcryptjs from 'bcryptjs';
 import postgres from 'postgres';
 
+/** A refused login for an email that is locked out; `authenticate` says so. */
+class LoginLocked extends CredentialsSignin {
+  code = LOCKED;
+}
+
 const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });
 
 async function getUser(email: string): Promise<User | undefined> {
@@ -29,11 +35,18 @@ export const { auth, signIn, signOut } = NextAuth({
 
         if (parsedCredentials.success) {
           const { email, password } = parsedCredentials.data;
+          const key = loginKey(email);
+          // Counted before the password is looked at, so a locked email learns
+          // nothing and concurrent attempts cannot get past the limit. An
+          // unknown email counts like a wrong password.
+          if (!(await claimAttempt(sql, key, loginLimits()))) throw new LoginLocked();
           const user = await getUser(email);
-          if (!user) return null;
-          const passwordsMatch = await bcryptjs.compare(password, user.password);
+          const passwordsMatch = user ? await bcryptjs.compare(password, user.password) : false;
 
-          if (passwordsMatch) return user;
+          if (user && passwordsMatch) {
+            await clearFailures(sql, key);
+            return user;
+          }
         }
 
         return null;
diff --git a/db/migrations/0004_login_failures.sql b/db/migrations/0004_login_failures.sql
new file mode 100644
index 0000000..2f6b21a
--- /dev/null
+++ b/db/migrations/0004_login_failures.sql
@@ -0,0 +1,12 @@
+-- Failed logins per email, for the login lockout (app/lib/login-limit.ts):
+-- after N failures in a row an email is refused until locked_until. Keyed by
+-- the email as typed, trimmed and lower-cased, whether or not a user has it,
+-- so a lockout says nothing about which emails exist. A new table: nothing
+-- existing changes.
+CREATE TABLE login_failures (
+  email TEXT PRIMARY KEY,
+  -- Attempts since the last success or since a lock ran out (counted before the
+  -- password is compared, and during a lock too).
+  failures INT NOT NULL CHECK (failures >= 0),
+  locked_until TIMESTAMPTZ
+);
diff --git a/playwright.config.ts b/playwright.config.ts
index 9e7207f..b6d1103 100644
--- a/playwright.config.ts
+++ b/playwright.config.ts
@@ -56,6 +56,10 @@ export default defineConfig({
       AUTH_TRUST_HOST: 'true',
       // .env's AUTH_URL names `npm run dev`'s port; after a login NextAuth would redirect there.
       AUTH_URL: `http://localhost:${PORT}`,
+      // The login lockout's limits, as tests/e2e/login-limit.spec.ts expects them,
+      // whatever .env sets.
+      LOGIN_MAX_FAILURES: '5',
+      LOGIN_LOCK_MINUTES: '15',
       // Overrides .env, which Next would otherwise load: the server must use the test schema.
       ...(database ? { POSTGRES_URL: database } : {}),
     },
diff --git a/tests/e2e/dashboard.spec.ts b/tests/e2e/dashboard.spec.ts
index a51f048..82ca942 100644
--- a/tests/e2e/dashboard.spec.ts
+++ b/tests/e2e/dashboard.spec.ts
@@ -20,9 +20,12 @@ test('the demo user logs in and the dashboard shows the seeded data', async ({ p
   await expect(page.getByRole('cell', { name: 'Evil Rabbit' }).first()).toBeVisible();
 });
 
-test('a wrong password is refused', async ({ page }) => {
+// An email no user has gets the same answer as a wrong password. (A wrong password
+// for a real user is in login-limit.spec.ts, on a user of its own: a failed login
+// counts towards a lockout, so no test fails the demo user's.)
+test('an unknown email is refused like a wrong password', async ({ page }) => {
   await page.goto('/login');
-  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Email').fill(`nobody-${Date.now().toString(36)}@example.com`);
   await page.getByLabel('Password', { exact: true }).fill('not-the-password');
   await page.getByRole('button', { name: /log in/i }).click();
 
diff --git a/tests/e2e/invoice-detail.spec.ts b/tests/e2e/invoice-detail.spec.ts
index bc65a95..121f809 100644
--- a/tests/e2e/invoice-detail.spec.ts
+++ b/tests/e2e/invoice-detail.spec.ts
@@ -46,7 +46,11 @@ test('an invoice has a detail page, reached from the list', async ({ page }) =>
   const details = page.locator('dl');
   await expect(details).toContainText(dollars(cents));
   await expect(details).toContainText('amy@burns.com');
-  await expect(page.getByText('Pending')).toBeVisible();
+  // Within the invoice's own section: just after the client navigation the list's
+  // rows (with their own "Pending") can still be in the page.
+  await expect(
+    page.getByRole('region', { name: 'Amy Burns' }).getByText('Pending', { exact: true })
+  ).toBeVisible();
 });
 
 test('deleting asks first, in a dialog that keeps focus, cancels on Esc and gives focus back', async ({
diff --git a/tests/e2e/login-limit.spec.ts b/tests/e2e/login-limit.spec.ts
new file mode 100644
index 0000000..a5f5060
--- /dev/null
+++ b/tests/e2e/login-limit.spec.ts
@@ -0,0 +1,65 @@
+import bcryptjs from 'bcryptjs';
+import postgres from 'postgres';
+import { type Page, expect, test } from '@playwright/test';
+
+// The login lockout, against the test schema global-setup.ts rebuilds. Each test
+// makes a user of its own (written straight into the test schema: there is no
+// sign-up page), so the demo user others log in as is never locked.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+// LOGIN_MAX_FAILURES, as playwright.config.ts gives it to the test server.
+const maxFailures = 5;
+const PASSWORD = 'right-password';
+
+async function createUser() {
+  const email = `lockout-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
+  const sql = postgres(process.env.E2E_POSTGRES_URL!, { ssl: 'require', max: 1 });
+  try {
+    await sql`
+      INSERT INTO users (name, email, password)
+      VALUES ('Lockout Test', ${email}, ${await bcryptjs.hash(PASSWORD, 10)})`;
+  } finally {
+    await sql.end();
+  }
+  return email;
+}
+
+async function logIn(page: Page, email: string, password: string) {
+  await page.goto('/login');
+  await page.getByLabel('Email').fill(email);
+  await page.getByLabel('Password', { exact: true }).fill(password);
+  await page.getByRole('button', { name: /log in/i }).click();
+}
+
+async function failLogIn(page: Page, email: string) {
+  await logIn(page, email, 'wrong-password');
+  await expect(page.getByText('Invalid credentials.')).toBeVisible();
+}
+
+test(`after ${maxFailures} failed logins the email is refused, even with the right password`, async ({
+  page,
+}) => {
+  test.setTimeout(90_000);
+  const email = await createUser();
+  for (let i = 0; i < maxFailures; i++) await failLogIn(page, email);
+
+  await logIn(page, email.toUpperCase(), PASSWORD);
+  await expect(
+    page.getByText('Too many failed logins for this email. Try again later.')
+  ).toBeVisible();
+  await expect(page).toHaveURL(/\/login/);
+});
+
+test('a successful login starts the count again', async ({ page }) => {
+  test.setTimeout(90_000);
+  const email = await createUser();
+  for (let i = 0; i < maxFailures - 1; i++) await failLogIn(page, email);
+  await logIn(page, email, PASSWORD);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
+
+  // As many failures again would have locked it, had the count not started over.
+  await page.context().clearCookies();
+  for (let i = 0; i < maxFailures - 1; i++) await failLogIn(page, email);
+  await logIn(page, email, PASSWORD);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
+});
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index 3fd8aba..ee6cef0 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -2,16 +2,22 @@ import { beforeEach, describe, expect, it, vi } from 'vitest';
 
 // Nothing here reaches a database or a real session: `postgres`, `@/auth` and the
 // Next.js runtime helpers the actions call are all replaced with fakes.
-const { sql, auth, revalidatePath, redirect } = vi.hoisted(() => ({
+const { sql, auth, signIn, revalidatePath, redirect } = vi.hoisted(() => ({
   sql: vi.fn(),
   auth: vi.fn(),
+  signIn: vi.fn(),
   revalidatePath: vi.fn(),
   redirect: vi.fn(),
 }));
 
 vi.mock('postgres', () => ({ default: () => sql }));
-vi.mock('@/auth', () => ({ auth, signIn: vi.fn() }));
-vi.mock('next-auth', () => ({ AuthError: class AuthError extends Error {} }));
+vi.mock('@/auth', () => ({ auth, signIn }));
+vi.mock('next-auth', () => ({
+  AuthError: class AuthError extends Error {
+    type = 'CredentialsSignin';
+    code = 'credentials';
+  },
+}));
 vi.mock('next/cache', () => ({ revalidatePath }));
 vi.mock('next/navigation', () => ({ redirect }));
 
@@ -23,6 +29,7 @@ const {
   createCustomer,
   updateCustomer,
   deleteCustomer,
+  authenticate,
 } = await import('@/app/lib/actions');
 
 function invoiceForm(fields: Record<string, string> = {}) {
@@ -275,3 +282,22 @@ describe('amounts in cents', () => {
     expect(sql.mock.calls[0][2]).toBe(29);
   });
 });
+
+describe('authenticate', () => {
+  const failure = async (code: string) => {
+    const { AuthError } = await import('next-auth');
+    return Object.assign(new AuthError(), { code });
+  };
+
+  it('says the credentials are wrong, and nothing more', async () => {
+    signIn.mockRejectedValue(await failure('credentials'));
+    expect(await authenticate(undefined, new FormData())).toBe('Invalid credentials.');
+  });
+
+  it('says when the email is locked out', async () => {
+    signIn.mockRejectedValue(await failure('locked'));
+    expect(await authenticate(undefined, new FormData())).toBe(
+      'Too many failed logins for this email. Try again later.'
+    );
+  });
+});
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
index 5a48b86..4d3019b 100644
--- a/tests/unit/data.test.ts
+++ b/tests/unit/data.test.ts
@@ -7,7 +7,8 @@ import { percentChange } from '@/app/lib/dashboard';
 import { customers, invoices } from '@/app/lib/placeholder-data';
 import { formatCurrency } from '@/app/lib/utils';
 
-// Every query in app/lib/data.ts against a real database: its own schema,
+// Every query in app/lib/data.ts (and the login lockout's statements) against a
+// real database: its own schema,
 // `xenocats_vitest`, on the server POSTGRES_URL names (the environment's, else
 // .env's), rebuilt from db/migrations and the seed before this file runs. The
 // browser tests use `xenocats_test`, so the two suites never meet. Like them,
@@ -298,6 +299,59 @@ describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
   });
 });
 
+// The login lockout's statements (app/lib/login-limit.ts) against the same schema,
+// which the suite above has just rebuilt; each test on an email of its own.
+describe.skipIf(!url)('the login lockout in the database', () => {
+  let sql: postgres.Sql;
+  let lockout: typeof import('@/app/lib/login-limit');
+  const limits = { maxFailures: 3, lockMinutes: 15 };
+  const email = (name: string) => `${name}-${Date.now().toString(36)}@example.com`;
+
+  beforeAll(async () => {
+    sql = postgres(url!, { ssl: 'require', max: 8, onnotice: () => {} });
+    lockout = await import('@/app/lib/login-limit');
+  });
+
+  afterAll(async () => {
+    await sql.end();
+  });
+
+  it('lets exactly N of many simultaneous attempts through, then holds the lock', async () => {
+    const key = email('burst');
+    const results = await Promise.all(
+      Array.from({ length: limits.maxFailures + 5 }, () => lockout.claimAttempt(sql, key, limits))
+    );
+    expect(results.filter(Boolean)).toHaveLength(limits.maxFailures);
+    expect(await lockout.claimAttempt(sql, key, limits)).toBe(false);
+    const [row] = await sql`
+      SELECT locked_until > now() + interval '14 minutes' AS locked FROM login_failures
+      WHERE email = ${key}`;
+    expect(row.locked).toBe(true);
+  });
+
+  it('a success clears the count and the lock its last attempt set', async () => {
+    const key = email('success');
+    for (let i = 0; i < limits.maxFailures; i++) {
+      expect(await lockout.claimAttempt(sql, key, limits)).toBe(true);
+    }
+    // The Nth attempt's password was right after all.
+    await lockout.clearFailures(sql, key);
+    expect(await lockout.claimAttempt(sql, key, limits)).toBe(true);
+  });
+
+  it('a lock that has run out starts the count again', async () => {
+    const key = email('expired');
+    for (let i = 0; i <= limits.maxFailures; i++) await lockout.claimAttempt(sql, key, limits);
+    expect(await lockout.claimAttempt(sql, key, limits)).toBe(false);
+    await sql`
+      UPDATE login_failures SET locked_until = now() - interval '1 second' WHERE email = ${key}`;
+    for (let i = 0; i < limits.maxFailures; i++) {
+      expect(await lockout.claimAttempt(sql, key, limits)).toBe(true);
+    }
+    expect(await lockout.claimAttempt(sql, key, limits)).toBe(false);
+  });
+});
+
 // Migration 0003 on a table that already holds invoices: applied after 0001 and
 // 0002 to rows written without a due date. Its own schema, dropped afterwards.
 describe.skipIf(!url)('migration 0003 on existing invoices', () => {
diff --git a/tests/unit/login-limit.test.ts b/tests/unit/login-limit.test.ts
new file mode 100644
index 0000000..f3b3506
--- /dev/null
+++ b/tests/unit/login-limit.test.ts
@@ -0,0 +1,89 @@
+import type { Sql } from 'postgres';
+import { describe, expect, it, vi } from 'vitest';
+import { claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
+
+// The lockout's settings, its decisions and the statements it sends. The
+// statements themselves run against a real database in the browser test
+// (tests/e2e/login-limit.spec.ts).
+
+describe('loginLimits', () => {
+  it('defaults to 5 failures and 15 minutes', () => {
+    expect(loginLimits({})).toEqual({ maxFailures: 5, lockMinutes: 15 });
+  });
+
+  it('takes whole numbers above zero from the environment', () => {
+    expect(loginLimits({ LOGIN_MAX_FAILURES: '3', LOGIN_LOCK_MINUTES: '60' })).toEqual({
+      maxFailures: 3,
+      lockMinutes: 60,
+    });
+  });
+
+  it('falls back on anything else', () => {
+    for (const value of ['', '0', '-2', '2.5', 'five', ' ']) {
+      expect(loginLimits({ LOGIN_MAX_FAILURES: value, LOGIN_LOCK_MINUTES: value })).toEqual({
+        maxFailures: 5,
+        lockMinutes: 15,
+      });
+    }
+  });
+});
+
+describe('loginKey', () => {
+  it('counts an email however it is typed', () => {
+    expect(loginKey('  User@NextMail.com ')).toBe('user@nextmail.com');
+  });
+});
+
+/** A fake `sql` tag: records each statement's text and values, answers with `rows`. */
+function fakeSql(rows: (call: number) => unknown[] = () => []) {
+  const calls: { text: string; values: unknown[] }[] = [];
+  const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
+    calls.push({ text: strings.join('?').replace(/\s+/g, ' ').trim(), values });
+    return Promise.resolve(rows(calls.length));
+  });
+  return { sql: sql as unknown as Sql, calls };
+}
+
+const limits = { maxFailures: 3, lockMinutes: 20 };
+
+describe('claimAttempt', () => {
+  it('counts the attempt in one upsert, with N and M as values', async () => {
+    const { sql, calls } = fakeSql(() => [{ attempt: 1 }]);
+    await claimAttempt(sql, 'a@b.c', limits);
+    expect(calls).toHaveLength(1);
+    expect(calls[0].text).toMatch(/^INSERT INTO login_failures .* ON CONFLICT \(email\) DO UPDATE/);
+    expect(calls[0].text).toContain('RETURNING failures AS attempt');
+    // Parameters, never text: the email first, then only N and M.
+    expect(calls[0].values[0]).toBe('a@b.c');
+    expect(new Set(calls[0].values.slice(1))).toEqual(new Set([3, 20]));
+  });
+
+  it('lets the first N attempts compare a password, and no more', async () => {
+    for (const [attempt, allowed] of [
+      [1, true],
+      [3, true],
+      [4, false],
+    ] as const) {
+      expect(await claimAttempt(fakeSql(() => [{ attempt }]).sql, 'a@b.c', limits)).toBe(allowed);
+    }
+  });
+
+  it('holds the limit when many attempts arrive at once', async () => {
+    // The database numbers concurrent upserts one after another; so does this fake.
+    const { sql } = fakeSql((call) => [{ attempt: call }]);
+    const results = await Promise.all(
+      Array.from({ length: limits.maxFailures + 3 }, () => claimAttempt(sql, 'a@b.c', limits))
+    );
+    expect(results.filter(Boolean)).toHaveLength(limits.maxFailures);
+  });
+});
+
+describe('clearFailures', () => {
+  it("forgets the email's attempts and any lock", async () => {
+    const { sql, calls } = fakeSql();
+    await clearFailures(sql, 'a@b.c');
+    expect(calls).toEqual([
+      { text: 'DELETE FROM login_failures WHERE email = ?', values: ['a@b.c'] },
+    ]);
+  });
+});
~~~~

</details>

#### T18 — `night-2026-10-01-t18-security-headers`

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

<details><summary>Code:  3 files changed, 189 insertions(+), 9 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index f119b63..d5bdbb5 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -107,16 +107,32 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard, customers, invoices)
+      - name: Browser tests against next start (smoke, branding, dashboard, login, headers)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
-          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
-          tests/e2e/invoice-export tests/e2e/invoices tests/e2e/login-limit
+          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
+          tests/e2e/security-headers
           --output test-results/smoke
         env:
           E2E_SERVER: start
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
+      - name: Browser tests against next start (customers)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/customers
+          --output test-results/customers
+        env:
+          E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/customers
+      - name: Browser tests against next start (invoices)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/invoices-filter tests/e2e/invoice-detail tests/e2e/invoice-export
+          tests/e2e/invoices
+          --output test-results/invoices
+        env:
+          E2E_SERVER: start
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/invoices
       - name: Browser tests against next start (cats, petting, touch)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: npx playwright test tests/e2e/cats tests/e2e/pet-cat tests/e2e/touch --output test-results/cats
@@ -182,15 +198,29 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard, customers, invoices)
+      - name: Browser tests (smoke, branding, dashboard, login, headers)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
-          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard
-          tests/e2e/customers tests/e2e/invoices-filter tests/e2e/invoice-detail
-          tests/e2e/invoice-export tests/e2e/invoices tests/e2e/login-limit
+          npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
+          tests/e2e/security-headers
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
+      - name: Browser tests (customers)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/customers
+          --output test-results/customers
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/customers
+      - name: Browser tests (invoices)
+        if: ${{ !cancelled() && steps.install.outcome == 'success' }}
+        run: >-
+          npx playwright test tests/e2e/invoices-filter tests/e2e/invoice-detail tests/e2e/invoice-export
+          tests/e2e/invoices
+          --output test-results/invoices
+        env:
+          PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/invoices
       - name: Browser tests (cats, petting, touch)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: npx playwright test tests/e2e/cats tests/e2e/pet-cat tests/e2e/touch --output test-results/cats
diff --git a/next.config.ts b/next.config.ts
index 5e891cf..9009514 100644
--- a/next.config.ts
+++ b/next.config.ts
@@ -1,7 +1,45 @@
 import type { NextConfig } from 'next';
 
+// Security headers on every response. The Content-Security-Policy is fixed here
+// rather than built per request, so it cannot carry a nonce: Next's own inline
+// scripts (the page's flight data) need 'unsafe-inline' for scripts, and the
+// cats' and charts' inline styles need it for styles. Everything else the app
+// loads is its own: fonts self-hosted by next/font, images from /public and
+// /_next/image (and data: URIs, e.g. the form plugin's SVG icons), sounds
+// synthesised with Web Audio (which CSP does not govern).
+// `next dev` also needs eval (React's dev tooling) and a WebSocket (hot reload).
+const isDev = process.env.NODE_ENV === 'development';
+
+const contentSecurityPolicy = [
+  "default-src 'self'",
+  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
+  "style-src 'self' 'unsafe-inline'",
+  "img-src 'self' data:",
+  "font-src 'self'",
+  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
+  "object-src 'none'",
+  "base-uri 'self'",
+  "form-action 'self'",
+  "frame-ancestors 'none'",
+].join('; ');
+
+const securityHeaders = [
+  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
+  { key: 'X-Content-Type-Options', value: 'nosniff' },
+  { key: 'X-Frame-Options', value: 'DENY' },
+  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
+  // Browsers honour it only over HTTPS, so it does nothing on http://localhost.
+  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
+  {
+    key: 'Permissions-Policy',
+    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
+  },
+];
+
 const nextConfig: NextConfig = {
-  /* config options here */
+  async headers() {
+    return [{ source: '/:path*', headers: securityHeaders }];
+  },
 };
 
 export default nextConfig;
diff --git a/tests/e2e/security-headers.spec.ts b/tests/e2e/security-headers.spec.ts
new file mode 100644
index 0000000..4e6feca
--- /dev/null
+++ b/tests/e2e/security-headers.spec.ts
@@ -0,0 +1,112 @@
+import { type Page, expect, test } from '@playwright/test';
+
+// The security headers from next.config.ts: present on every page, and strict
+// enough to matter, yet the pages still work under them. The rest of the suite
+// runs under the same policy, cats, sounds and forms included.
+
+test('every page response carries the security headers', async ({ request }) => {
+  for (const path of ['/', '/login', '/cats', '/dashboard']) {
+    const response = await request.get(path, { maxRedirects: 0 });
+    const headers = response.headers();
+    const csp = headers['content-security-policy'] ?? '';
+    expect(csp, path).toContain("default-src 'self'");
+    expect(csp, path).toContain("object-src 'none'");
+    expect(csp, path).toContain("frame-ancestors 'none'");
+    expect(csp, path).toContain("base-uri 'self'");
+    expect(headers['x-content-type-options'], path).toBe('nosniff');
+    expect(headers['x-frame-options'], path).toBe('DENY');
+    expect(headers['referrer-policy'], path).toBe('strict-origin-when-cross-origin');
+    expect(headers['strict-transport-security'], path).toMatch(/max-age=\d+/);
+    expect(headers['permissions-policy'], path).toContain('camera=()');
+  }
+});
+
+/**
+ * Collects what the browser reports when the policy blocks something: the DOM's
+ * `securitypolicyviolation` event (relayed to the console from every page), and
+ * Chrome's own console report as a second witness.
+ */
+async function watchForViolations(page: Page) {
+  const violations: string[] = [];
+  await page.addInitScript(() => {
+    document.addEventListener('securitypolicyviolation', (event) => {
+      console.error(`CSP violation: ${event.violatedDirective} ${event.blockedURI}`);
+    });
+  });
+  page.on('console', (message) => {
+    const text = message.text();
+    if (text.includes('CSP violation') || text.includes('Content Security Policy')) {
+      violations.push(text);
+    }
+  });
+  page.on('pageerror', (error) => violations.push(`page error: ${error.message}`));
+  return violations;
+}
+
+test('the public pages run under the policy: scripts and styles', async ({ page }) => {
+  const violations = await watchForViolations(page);
+  await page.goto('/');
+  await expect(page.getByRole('link', { name: /log in/i }).first()).toBeVisible();
+  await page.goto('/login');
+  await page.waitForLoadState('networkidle');
+  // Hydrated: the client-side password toggle works.
+  const toggle = page.getByRole('button', { name: 'Show password' });
+  await toggle.click();
+  await expect(page.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
+    'aria-pressed',
+    'true'
+  );
+  expect(violations).toEqual([]);
+});
+
+test('logged in, the dashboard pages run under the policy', async ({ page }) => {
+  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+  const violations = await watchForViolations(page);
+  await page.goto('/login');
+  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Password', { exact: true }).fill('123456');
+  await page.getByRole('button', { name: /log in/i }).click();
+  await expect(page).toHaveURL(/\/dashboard$/);
+  for (const [path, heading] of [
+    ['/dashboard', /captain/i],
+    ['/dashboard/invoices', /^invoices$/i],
+    ['/dashboard/customers', /^customers$/i],
+  ] as const) {
+    await page.goto(path);
+    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
+    // The cats' layer: client code that draws with inline styles.
+    await expect(page.getByTestId('xenocat-page')).toBeAttached();
+    await page.waitForLoadState('networkidle');
+  }
+  // A client-side interaction: the search box updates the URL.
+  await page.getByPlaceholder(/search/i).fill('Amy');
+  await expect(page).toHaveURL(/query=Amy/);
+  expect(violations).toEqual([]);
+});
+
+test('the cats run under the policy: a summoned cat appears, drawn with inline styles', async ({
+  page,
+}) => {
+  const violations = await watchForViolations(page);
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await expect(page.getByRole('heading', { name: 'The cats' })).toBeVisible();
+  await page.waitForLoadState('networkidle');
+  // Asleep, so it stays put and does nothing to the cursor while the test looks.
+  const summon = page.getByTestId('summon-asleep-void-tabby');
+  await summon.scrollIntoViewIfNeeded();
+  await summon.click();
+  await expect(page.getByTestId('xenocat')).toBeVisible();
+  expect(violations).toEqual([]);
+});
+
+test('the policy blocks an outside image, and the watcher above sees it', async ({ page }) => {
+  const violations = await watchForViolations(page);
+  await page.goto('/login');
+  await page.evaluate(() => {
+    const image = document.createElement('img');
+    image.src = 'https://example.com/tracker.png';
+    document.body.append(image);
+  });
+  await expect.poll(() => violations.join('\n')).toContain('CSP violation: img-src');
+});
~~~~

</details>

#### T19 — `night-2026-10-01-t19-change-password`

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

<details><summary>Code:  9 files changed, 397 insertions(+), 4 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index d5bdbb5..2b683b9 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -107,10 +107,11 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard, login, headers)
+      - name: Browser tests against next start (smoke, branding, dashboard, login, settings, headers)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
+          tests/e2e/change-password
           tests/e2e/security-headers
           --output test-results/smoke
         env:
@@ -198,10 +199,11 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard, login, headers)
+      - name: Browser tests (smoke, branding, dashboard, login, settings, headers)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
+          tests/e2e/change-password
           tests/e2e/security-headers
           --output test-results/smoke
         env:
diff --git a/app/dashboard/settings/page.tsx b/app/dashboard/settings/page.tsx
new file mode 100644
index 0000000..cce170a
--- /dev/null
+++ b/app/dashboard/settings/page.tsx
@@ -0,0 +1,22 @@
+import { Metadata } from 'next';
+import PasswordForm from '@/app/ui/settings/password-form';
+
+export const metadata: Metadata = {
+  title: 'Settings',
+};
+
+export default function Page() {
+  return (
+    <main className="max-w-xl">
+      <h1 className="mb-8 font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
+        Settings
+      </h1>
+      <section aria-labelledby="password-heading">
+        <h2 id="password-heading" className="mb-4 text-xl font-semibold text-white">
+          Change password
+        </h2>
+        <PasswordForm />
+      </section>
+    </main>
+  );
+}
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index a6776cf..cbd400e 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -2,11 +2,13 @@
 
 import { revalidatePath } from 'next/cache';
 import { redirect } from 'next/navigation';
+import bcryptjs from 'bcryptjs';
 import postgres from 'postgres';
 import { auth, signIn } from '@/auth';
 import { AuthError, type CredentialsSignin } from 'next-auth';
-import { LOCKED } from '@/app/lib/login-limit';
+import { LOCKED, claimAttempt, clearFailures, loginKey, loginLimits } from '@/app/lib/login-limit';
 import {
+  ChangePasswordForm,
   CreateInvoice,
   CustomerForm,
   CustomerId,
@@ -282,3 +284,64 @@ export async function authenticate(prevState: string | undefined, formData: Form
     throw error;
   }
 }
+
+export type PasswordState = {
+  errors?: {
+    currentPassword?: string[];
+    newPassword?: string[];
+    confirmPassword?: string[];
+  };
+  message?: string | null;
+  /** The password was changed. */
+  done?: boolean;
+};
+
+/**
+ * The logged-in user changes their password: the current one must be right, the
+ * new one valid (ChangePasswordForm); it is stored as a bcrypt hash. Checking the
+ * current password is a guess at it like a login, so it counts towards the same
+ * lockout (app/lib/login-limit.ts).
+ */
+export async function changePassword(
+  prevState: PasswordState,
+  formData: FormData
+): Promise<PasswordState> {
+  const session = await auth();
+  const email = session?.user?.email;
+  if (!email) return { message: 'You must be logged in to change your password.' };
+
+  const validatedFields = ChangePasswordForm.safeParse({
+    currentPassword: formData.get('currentPassword'),
+    newPassword: formData.get('newPassword'),
+    confirmPassword: formData.get('confirmPassword'),
+  });
+  if (!validatedFields.success) {
+    return {
+      errors: validatedFields.error.flatten().fieldErrors,
+      message: 'Your password was not changed.',
+    };
+  }
+
+  const { currentPassword, newPassword } = validatedFields.data;
+  const key = loginKey(email);
+  try {
+    if (!(await claimAttempt(sql, key, loginLimits()))) {
+      return { message: 'Too many failed attempts for this account. Try again later.' };
+    }
+    const [user] = await sql<{ id: string; password: string }[]>`
+      SELECT id, password FROM users WHERE email = ${email}`;
+    if (!user || !(await bcryptjs.compare(currentPassword, user.password))) {
+      return {
+        errors: { currentPassword: ['That is not your current password.'] },
+        message: 'Your password was not changed.',
+      };
+    }
+    await clearFailures(sql, key);
+    const hash = await bcryptjs.hash(newPassword, 10);
+    await sql`UPDATE users SET password = ${hash} WHERE id = ${user.id}`;
+  } catch (error) {
+    console.error('Database Error:', error);
+    return { message: 'Database Error: Failed to change the password.' };
+  }
+  return { done: true, message: 'Your password has been changed.' };
+}
diff --git a/app/lib/schemas.ts b/app/lib/schemas.ts
index 29e3fe4..1650128 100644
--- a/app/lib/schemas.ts
+++ b/app/lib/schemas.ts
@@ -47,3 +47,31 @@ export type InvoiceStatusFilter = z.infer<typeof InvoiceStatusFilter>;
 
 export const parseStatusFilter = (value: string | undefined): InvoiceStatusFilter | null =>
   InvoiceStatusFilter.safeParse(value).data ?? null;
+
+const BCRYPT_MAX_BYTES = 72;
+
+/**
+ * The change-password form: the current password, and the new one typed twice.
+ * At least 8 characters; at most 72 bytes, beyond which bcrypt ignores the rest.
+ */
+export const ChangePasswordForm = z
+  .object({
+    currentPassword: z
+      .string({ invalid_type_error: 'Please enter your current password.' })
+      .min(1, { message: 'Please enter your current password.' }),
+    newPassword: z
+      .string({ invalid_type_error: 'Please choose a new password.' })
+      .min(8, { message: 'A new password needs at least 8 characters.' })
+      .refine((password) => new TextEncoder().encode(password).length <= BCRYPT_MAX_BYTES, {
+        message: 'A new password can be at most 72 bytes long.',
+      }),
+    confirmPassword: z.string({ invalid_type_error: 'Please type the new password again.' }),
+  })
+  .refine((form) => form.newPassword === form.confirmPassword, {
+    path: ['confirmPassword'],
+    message: 'The two new passwords do not match.',
+  })
+  .refine((form) => form.newPassword !== form.currentPassword, {
+    path: ['newPassword'],
+    message: 'The new password must differ from the current one.',
+  });
diff --git a/app/ui/dashboard/nav-links.tsx b/app/ui/dashboard/nav-links.tsx
index 108e0f6..4e537e9 100644
--- a/app/ui/dashboard/nav-links.tsx
+++ b/app/ui/dashboard/nav-links.tsx
@@ -1,6 +1,6 @@
 'use client';
 
-import { DocumentTextIcon, HomeIcon } from '@heroicons/react/24/outline';
+import { Cog6ToothIcon, DocumentTextIcon, HomeIcon } from '@heroicons/react/24/outline';
 import { UserGroupIcon } from '@heroicons/react/24/solid';
 import Link from 'next/link';
 import { usePathname } from 'next/navigation';
@@ -11,6 +11,7 @@ const links = [
   { name: 'Home', href: '/dashboard', icon: HomeIcon },
   { name: 'Invoices', href: '/dashboard/invoices', icon: DocumentTextIcon },
   { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
+  { name: 'Settings', href: '/dashboard/settings', icon: Cog6ToothIcon },
 ];
 
 export default function NavLinks() {
diff --git a/app/ui/settings/password-form.tsx b/app/ui/settings/password-form.tsx
new file mode 100644
index 0000000..9df606a
--- /dev/null
+++ b/app/ui/settings/password-form.tsx
@@ -0,0 +1,64 @@
+'use client';
+
+import { useActionState } from 'react';
+import { KeyIcon } from '@heroicons/react/24/solid';
+import clsx from 'clsx';
+import { type PasswordState, changePassword } from '@/app/lib/actions';
+import { Button } from '@/app/ui/button';
+
+const fields = [
+  { name: 'currentPassword', label: 'Current password', autoComplete: 'current-password' },
+  { name: 'newPassword', label: 'New password', autoComplete: 'new-password' },
+  { name: 'confirmPassword', label: 'Confirm new password', autoComplete: 'new-password' },
+] as const;
+
+/** Changes the logged-in user's password; each field's error is shown beside it. */
+export default function PasswordForm() {
+  const initialState: PasswordState = { message: null, errors: {} };
+  const [state, formAction, isPending] = useActionState(changePassword, initialState);
+
+  return (
+    <form action={formAction}>
+      <div className="rounded-2xl border border-line bg-panel p-4 md:p-6">
+        {fields.map((field) => (
+          <div key={field.name} className="mb-4 last:mb-0">
+            <label htmlFor={field.name} className="mb-2 block text-sm font-medium text-white">
+              {field.label}
+            </label>
+            <div className="relative">
+              <input
+                id={field.name}
+                name={field.name}
+                type="password"
+                autoComplete={field.autoComplete}
+                className="peer block w-full rounded-xl border border-line bg-void/70 py-2.5 pl-10 text-sm text-white placeholder:text-aura/60 focus:border-aura focus:ring-aura"
+                aria-describedby={`${field.name}-error`}
+              />
+              <KeyIcon className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-aura peer-focus:text-plasma" />
+            </div>
+            <div id={`${field.name}-error`} aria-live="polite" aria-atomic="true">
+              {state.errors?.[field.name]?.map((error: string) => (
+                <p className="mt-2 text-sm text-red-400" key={error}>
+                  {error}
+                </p>
+              ))}
+            </div>
+          </div>
+        ))}
+
+        <div aria-live="polite" aria-atomic="true">
+          {state.message && (
+            <p className={clsx('mt-4 text-sm', state.done ? 'text-plasma' : 'text-red-400')}>
+              {state.message}
+            </p>
+          )}
+        </div>
+      </div>
+      <div className="mt-6 flex justify-end">
+        <Button type="submit" aria-disabled={isPending}>
+          Change Password
+        </Button>
+      </div>
+    </form>
+  );
+}
diff --git a/tests/e2e/change-password.spec.ts b/tests/e2e/change-password.spec.ts
new file mode 100644
index 0000000..0d6b777
--- /dev/null
+++ b/tests/e2e/change-password.spec.ts
@@ -0,0 +1,89 @@
+import bcryptjs from 'bcryptjs';
+import postgres from 'postgres';
+import { type Page, expect, test } from '@playwright/test';
+
+// Changing the password on the settings page, against the test schema
+// global-setup.ts rebuilds, as a user of the test's own (written straight into
+// the schema: there is no sign-up page), so the demo user others log in as keeps
+// its password.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+const OLD = 'old-password-1';
+const NEW = 'new-password-2';
+
+async function createUser() {
+  const email = `password-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;
+  const sql = postgres(process.env.E2E_POSTGRES_URL!, { ssl: 'require', max: 1 });
+  try {
+    await sql`
+      INSERT INTO users (name, email, password)
+      VALUES ('Password Test', ${email}, ${await bcryptjs.hash(OLD, 10)})`;
+  } finally {
+    await sql.end();
+  }
+  return email;
+}
+
+async function logIn(page: Page, email: string, password: string) {
+  await page.goto('/login');
+  await page.getByLabel('Email').fill(email);
+  await page.getByLabel('Password', { exact: true }).fill(password);
+  await page.getByRole('button', { name: /log in/i }).click();
+}
+
+async function submit(page: Page, current: string, next: string, confirm = next) {
+  await page.getByLabel('Current password').fill(current);
+  await page.getByLabel('New password', { exact: true }).fill(next);
+  await page.getByLabel('Confirm new password').fill(confirm);
+  await page.getByRole('button', { name: 'Change Password' }).click();
+}
+
+test('a logged-in user changes their password: the new one works, the old one no longer', async ({
+  page,
+}) => {
+  test.setTimeout(90_000);
+  const email = await createUser();
+  await logIn(page, email, OLD);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
+
+  // The side navigation leads there. Loaded afresh rather than through the link:
+  // only a fresh page reliably goes network-idle (the sign of hydration) under
+  // `next start`, which keeps prefetching the dashboard's links.
+  await expect(page.getByRole('link', { name: 'Settings' }).first()).toHaveAttribute(
+    'href',
+    '/dashboard/settings'
+  );
+  await page.goto('/dashboard/settings');
+  await expect(page.getByRole('heading', { name: 'Change password' })).toBeVisible();
+  await page.waitForLoadState('networkidle');
+
+  // Refused, each error beside its field: a wrong current password...
+  await submit(page, 'not-my-password', NEW);
+  await expect(page.locator('#currentPassword-error')).toHaveText(
+    'That is not your current password.'
+  );
+  // ...and a confirmation that does not match.
+  await submit(page, OLD, NEW, 'something-else');
+  await expect(page.locator('#confirmPassword-error')).toHaveText(
+    'The two new passwords do not match.'
+  );
+  await expect(page.getByLabel('Current password')).toHaveAttribute(
+    'aria-describedby',
+    'currentPassword-error'
+  );
+
+  await submit(page, OLD, NEW);
+  await expect(page.getByText('Your password has been changed.')).toBeVisible();
+
+  // Signed out: the old password is refused, the new one lets the user in.
+  await page.context().clearCookies();
+  await logIn(page, email, OLD);
+  await expect(page.getByText('Invalid credentials.')).toBeVisible();
+  await logIn(page, email, NEW);
+  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
+});
+
+test('the settings page is behind the login', async ({ page }) => {
+  await page.goto('/dashboard/settings');
+  await expect(page).toHaveURL(/\/login/);
+});
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index ee6cef0..046eb9a 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -1,3 +1,4 @@
+import bcryptjs from 'bcryptjs';
 import { beforeEach, describe, expect, it, vi } from 'vitest';
 
 // Nothing here reaches a database or a real session: `postgres`, `@/auth` and the
@@ -30,6 +31,7 @@ const {
   updateCustomer,
   deleteCustomer,
   authenticate,
+  changePassword,
 } = await import('@/app/lib/actions');
 
 function invoiceForm(fields: Record<string, string> = {}) {
@@ -301,3 +303,74 @@ describe('authenticate', () => {
     );
   });
 });
+
+describe('changePassword', () => {
+  const passwordForm = (fields: Record<string, string> = {}) => {
+    const form = new FormData();
+    const values = {
+      currentPassword: 'old-password',
+      newPassword: 'new-password-1',
+      confirmPassword: 'new-password-1',
+      ...fields,
+    };
+    for (const [key, value] of Object.entries(values)) form.set(key, value);
+    return form;
+  };
+  const statements = () => sql.mock.calls.map((call) => (call[0] as string[]).join('?'));
+
+  it('refuses without a session, and touches nothing', async () => {
+    auth.mockResolvedValue(null);
+    expect(await changePassword({}, passwordForm())).toEqual({
+      message: 'You must be logged in to change your password.',
+    });
+    expect(sql).not.toHaveBeenCalled();
+  });
+
+  it('refuses an invalid form before anything else', async () => {
+    auth.mockResolvedValue(signedIn);
+    const result = await changePassword({}, passwordForm({ confirmPassword: 'other-password' }));
+    expect(result.errors?.confirmPassword).toEqual(['The two new passwords do not match.']);
+    expect(sql).not.toHaveBeenCalled();
+  });
+
+  it('refuses a wrong current password, and changes nothing', async () => {
+    auth.mockResolvedValue(signedIn);
+    const hash = await bcryptjs.hash('the-real-one', 4);
+    sql
+      .mockResolvedValueOnce([{ attempt: 1 }])
+      .mockResolvedValueOnce([{ id: 'u1', password: hash }]);
+    const result = await changePassword({}, passwordForm());
+    expect(result.errors?.currentPassword).toEqual(['That is not your current password.']);
+    expect(statements().some((text) => text.includes('UPDATE users'))).toBe(false);
+  });
+
+  it('refuses while the account is locked out, before comparing', async () => {
+    auth.mockResolvedValue(signedIn);
+    sql.mockResolvedValueOnce([{ attempt: 99 }]);
+    expect((await changePassword({}, passwordForm())).message).toBe(
+      'Too many failed attempts for this account. Try again later.'
+    );
+    expect(sql).toHaveBeenCalledTimes(1);
+  });
+
+  it('stores a bcrypt hash of the new password for the logged-in user', async () => {
+    auth.mockResolvedValue(signedIn);
+    const hash = await bcryptjs.hash('old-password', 4);
+    sql
+      .mockResolvedValueOnce([{ attempt: 1 }])
+      .mockResolvedValueOnce([{ id: 'u1', password: hash }]);
+    expect(await changePassword({}, passwordForm())).toEqual({
+      done: true,
+      message: 'Your password has been changed.',
+    });
+    // Looked up by the session's email, never by anything the form sends.
+    expect(sql.mock.calls[1].slice(1)).toEqual(['user@example.com']);
+    const update = sql.mock.calls.find((call) =>
+      (call[0] as string[]).join('?').includes('UPDATE users')
+    )!;
+    const [stored, id] = update.slice(1) as [string, string];
+    expect(id).toBe('u1');
+    expect(stored).not.toContain('new-password-1');
+    expect(await bcryptjs.compare('new-password-1', stored)).toBe(true);
+  });
+});
diff --git a/tests/unit/schemas.test.ts b/tests/unit/schemas.test.ts
index 4e2cd99..345a8a8 100644
--- a/tests/unit/schemas.test.ts
+++ b/tests/unit/schemas.test.ts
@@ -1,5 +1,6 @@
 import { describe, expect, it } from 'vitest';
 import {
+  ChangePasswordForm,
   CreateInvoice,
   CustomerForm,
   CustomerId,
@@ -124,3 +125,53 @@ describe('parseStatusFilter', () => {
     }
   });
 });
+
+describe('ChangePasswordForm', () => {
+  const form = (fields: Record<string, string | null> = {}) =>
+    ChangePasswordForm.safeParse({
+      currentPassword: 'old-password',
+      newPassword: 'new-password-1',
+      confirmPassword: 'new-password-1',
+      ...fields,
+    });
+  const errors = (result: ReturnType<typeof form>) =>
+    result.success ? {} : result.error.flatten().fieldErrors;
+
+  it('takes a current password and a new one typed twice', () => {
+    expect(form().success).toBe(true);
+  });
+
+  it('says what is missing, per field', () => {
+    expect(
+      errors(form({ currentPassword: null, newPassword: null, confirmPassword: null }))
+    ).toEqual({
+      currentPassword: ['Please enter your current password.'],
+      newPassword: ['Please choose a new password.'],
+      confirmPassword: ['Please type the new password again.'],
+    });
+    expect(errors(form({ currentPassword: '' })).currentPassword).toEqual([
+      'Please enter your current password.',
+    ]);
+  });
+
+  it('wants at least 8 characters and at most 72 bytes', () => {
+    expect(errors(form({ newPassword: 'short1', confirmPassword: 'short1' })).newPassword).toEqual([
+      'A new password needs at least 8 characters.',
+    ]);
+    // 24 three-byte characters: 72 bytes, the most bcrypt reads; one more is too long.
+    const at72 = '€'.repeat(24);
+    expect(form({ newPassword: at72, confirmPassword: at72 }).success).toBe(true);
+    expect(
+      errors(form({ newPassword: at72 + 'a', confirmPassword: at72 + 'a' })).newPassword
+    ).toEqual(['A new password can be at most 72 bytes long.']);
+  });
+
+  it('refuses a confirmation that differs, and a new password equal to the current one', () => {
+    expect(errors(form({ confirmPassword: 'something-else' })).confirmPassword).toEqual([
+      'The two new passwords do not match.',
+    ]);
+    expect(
+      errors(form({ newPassword: 'old-password', confirmPassword: 'old-password' })).newPassword
+    ).toEqual(['The new password must differ from the current one.']);
+  });
+});
~~~~

</details>

#### T20 — `night-2026-10-01-t20-leftovers`

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

<details><summary>Code:  5 files changed, 11 insertions(+), 9 deletions(-)</summary>

~~~~diff
diff --git a/CLAUDE.md b/CLAUDE.md
index 996c1da..0d405e0 100644
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -279,8 +279,8 @@ clean exit does not mean an empty report. Read the output; do not report "lint
 passed" as though it found nothing.
 
 Formatting is per file. `npm run format` rewrites the whole repository, and not
-every file matches `.prettierrc` (`app/query/route.ts` is indented with tabs),
-so it produces a drive-by diff. Run `prettier --check` / `--write` on the files
+every file matches `.prettierrc` (e.g. `tsconfig.json`, `global.d.ts` and
+`app/dashboard/(overview)/loading.tsx` do not), so it produces a drive-by diff. Run `prettier --check` / `--write` on the files
 the task changed.
 
 The running app, and possibly `npm run build` where a page prerenders, need
diff --git a/app/ui/dashboard/sidenav.tsx b/app/ui/dashboard/sidenav.tsx
index f0e6e0f..d4fe681 100644
--- a/app/ui/dashboard/sidenav.tsx
+++ b/app/ui/dashboard/sidenav.tsx
@@ -34,6 +34,9 @@ export default function SideNav() {
         alt=""
         width={228}
         height={305}
+        // In view on every dashboard page from the start, and often its largest image
+        // (Next flags it as the LCP): load it at once rather than lazily.
+        loading="eager"
         className="pointer-events-none absolute bottom-0 left-0 hidden w-full md:block"
       />
     </div>
diff --git a/next-env.d.ts b/next-env.d.ts
deleted file mode 100644
index 69d17a6..0000000
--- a/next-env.d.ts
+++ /dev/null
@@ -1,7 +0,0 @@
-/// <reference types="next" />
-/// <reference types="next/image-types/global" />
-import "./.next/dev/types/routes.d.ts";
-import "./.next/dev/types/root-params.d.ts";
-
-// NOTE: This file should not be edited
-// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
diff --git a/tests/e2e/change-password.spec.ts b/tests/e2e/change-password.spec.ts
index 0d6b777..a08b595 100644
--- a/tests/e2e/change-password.spec.ts
+++ b/tests/e2e/change-password.spec.ts
@@ -26,6 +26,9 @@ async function createUser() {
 
 async function logIn(page: Page, email: string, password: string) {
   await page.goto('/login');
+  // Filled before hydration, the form would be reset under the test's hands, and
+  // the message the test waits for would never come.
+  await page.waitForLoadState('networkidle');
   await page.getByLabel('Email').fill(email);
   await page.getByLabel('Password', { exact: true }).fill(password);
   await page.getByRole('button', { name: /log in/i }).click();
diff --git a/tests/e2e/login-limit.spec.ts b/tests/e2e/login-limit.spec.ts
index a5f5060..e8a76ae 100644
--- a/tests/e2e/login-limit.spec.ts
+++ b/tests/e2e/login-limit.spec.ts
@@ -26,6 +26,9 @@ async function createUser() {
 
 async function logIn(page: Page, email: string, password: string) {
   await page.goto('/login');
+  // Filled before hydration, the form would be reset under the test's hands, and
+  // the message the test waits for would never come.
+  await page.waitForLoadState('networkidle');
   await page.getByLabel('Email').fill(email);
   await page.getByLabel('Password', { exact: true }).fill(password);
   await page.getByRole('button', { name: /log in/i }).click();
~~~~

</details>

#### Tc4 — `night-2026-10-01-c4-checkpoint`

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

<details><summary>Code:  4 files changed, 26 insertions(+), 9 deletions(-)</summary>

~~~~diff
diff --git a/app/lib/actions.ts b/app/lib/actions.ts
index cbd400e..1d96403 100644
--- a/app/lib/actions.ts
+++ b/app/lib/actions.ts
@@ -299,8 +299,9 @@ export type PasswordState = {
 /**
  * The logged-in user changes their password: the current one must be right, the
  * new one valid (ChangePasswordForm); it is stored as a bcrypt hash. Checking the
- * current password is a guess at it like a login, so it counts towards the same
- * lockout (app/lib/login-limit.ts).
+ * current password is a guess at it, so it is limited like a login
+ * (app/lib/login-limit.ts), but counted apart: failed logins by someone else
+ * cannot stop the user changing their password, nor the reverse.
  */
 export async function changePassword(
   prevState: PasswordState,
@@ -323,7 +324,7 @@ export async function changePassword(
   }
 
   const { currentPassword, newPassword } = validatedFields.data;
-  const key = loginKey(email);
+  const key = `change-password:${loginKey(email)}`;
   try {
     if (!(await claimAttempt(sql, key, loginLimits()))) {
       return { message: 'Too many failed attempts for this account. Try again later.' };
diff --git a/tests/unit/actions.test.ts b/tests/unit/actions.test.ts
index 046eb9a..1fd7892 100644
--- a/tests/unit/actions.test.ts
+++ b/tests/unit/actions.test.ts
@@ -363,6 +363,8 @@ describe('changePassword', () => {
       done: true,
       message: 'Your password has been changed.',
     });
+    // Counted apart from logins, so failed logins cannot block a change.
+    expect(sql.mock.calls[0][1]).toBe('change-password:user@example.com');
     // Looked up by the session's email, never by anything the form sends.
     expect(sql.mock.calls[1].slice(1)).toEqual(['user@example.com']);
     const update = sql.mock.calls.find((call) =>
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
index 4d3019b..05f99a3 100644
--- a/tests/unit/data.test.ts
+++ b/tests/unit/data.test.ts
@@ -47,15 +47,21 @@ const today = new Date().toISOString().slice(0, 10);
 const addDays = (date: string, days: number) =>
   new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
 
+// The schema is rebuilt once for the whole file, so any block below also runs on
+// its own (e.g. with -t).
+beforeAll(() => {
+  if (!url) return;
+  execFileSync(
+    process.execPath,
+    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/db.mjs', 'reset'],
+    { env: { ...process.env, POSTGRES_URL: url }, stdio: 'pipe' }
+  );
+}, 60_000);
+
 describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
   let data: typeof import('@/app/lib/data');
 
   beforeAll(async () => {
-    execFileSync(
-      process.execPath,
-      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', 'scripts/db.mjs', 'reset'],
-      { env: { ...process.env, POSTGRES_URL: url! }, stdio: 'pipe' }
-    );
     // data.ts connects to POSTGRES_URL when it is first imported.
     process.env.POSTGRES_URL = url!;
     data = await import('@/app/lib/data');
@@ -300,7 +306,7 @@ describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
 });
 
 // The login lockout's statements (app/lib/login-limit.ts) against the same schema,
-// which the suite above has just rebuilt; each test on an email of its own.
+// which the file-level beforeAll rebuilds; each test on an email of its own.
 describe.skipIf(!url)('the login lockout in the database', () => {
   let sql: postgres.Sql;
   let lockout: typeof import('@/app/lib/login-limit');
diff --git a/tests/unit/seed-data.test.ts b/tests/unit/seed-data.test.ts
index 6d2fdcb..e3b2103 100644
--- a/tests/unit/seed-data.test.ts
+++ b/tests/unit/seed-data.test.ts
@@ -50,4 +50,12 @@ describe('the migrations', () => {
     expect(body).toMatch(/CHECK \(due_date >= date\)/);
     expect(body).not.toMatch(/\bDROP\b/i);
   });
+
+  it('add the login lockout table, keyed by email, touching nothing else', () => {
+    const body = readFileSync(new URL('0004_login_failures.sql', dir), 'utf8');
+    expect(body).toMatch(/CREATE TABLE login_failures \(\s*email TEXT PRIMARY KEY/);
+    expect(body).toMatch(/failures INT NOT NULL CHECK \(failures >= 0\)/);
+    expect(body).toMatch(/locked_until TIMESTAMPTZ/);
+    expect(body).not.toMatch(/\b(DROP|ALTER|UPDATE|DELETE)\b/i);
+  });
 });
~~~~

</details>

#### T21 — `night-2026-10-01-t21-revenue-from-invoices`

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

<details><summary>Code:  1 file changed, 13 insertions(+)</summary>

~~~~diff
diff --git a/tests/unit/data.test.ts b/tests/unit/data.test.ts
index 05f99a3..983fabe 100644
--- a/tests/unit/data.test.ts
+++ b/tests/unit/data.test.ts
@@ -302,6 +302,19 @@ describe.skipIf(!url)('the queries in app/lib/data.ts', () => {
       ]);
       expect(await data.fetchInvoicesPages(tag, 'overdue')).toBe(1);
     });
+
+    it('new invoices show in the revenue chart and the cards, computed from the invoices', async () => {
+      // The seed is all from 2022–2023: in the last 12 months only these two count.
+      const months = await data.fetchMonthlyTotals('12m');
+      const month = (date: string) => months.find((m) => m.month === date.slice(0, 7))!;
+      expect(month(today)).toEqual({ month: today.slice(0, 7), paid: 0, pending: 1111 });
+      expect(month(addDays(today, -40)).pending).toBe(2222);
+      expect(months.reduce((total, m) => total + m.paid + m.pending, 0)).toBe(3333);
+
+      const cards = await data.fetchCardData('12m');
+      expect(cards.pending.value).toBe(3333);
+      expect(cards.invoices.value).toBe(2);
+    });
   });
 });
 
~~~~

</details>

#### T22 — `night-2026-10-01-t22-cat-states`

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

<details><summary>Code:  15 files changed, 279 insertions(+), 82 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 2b683b9..e46a355 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -32,7 +32,7 @@ jobs:
           npx vitest run tests/unit/actions tests/unit/schemas tests/unit/utils
           tests/unit/auth-config tests/unit/dashboard tests/unit/proxy-matcher tests/unit/seed-data
           tests/unit/csv tests/unit/export-route tests/unit/invoice-status
-          tests/unit/login-limit
+          tests/unit/login-limit tests/unit/cat-error
       - name: Unit tests (cats, Node)
         if: ${{ !cancelled() }}
         run: >-
@@ -107,12 +107,12 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard, login, settings, headers)
+      - name: Browser tests against next start (smoke, branding, dashboard, login, settings, headers, states)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           tests/e2e/change-password
-          tests/e2e/security-headers
+          tests/e2e/security-headers tests/e2e/cat-states
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -199,12 +199,12 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard, login, settings, headers)
+      - name: Browser tests (smoke, branding, dashboard, login, settings, headers, states)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           tests/e2e/change-password
-          tests/e2e/security-headers
+          tests/e2e/security-headers tests/e2e/cat-states
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/app/dashboard/customers/[id]/edit/not-found.tsx b/app/dashboard/customers/[id]/edit/not-found.tsx
index fce7b6b..8467578 100644
--- a/app/dashboard/customers/[id]/edit/not-found.tsx
+++ b/app/dashboard/customers/[id]/edit/not-found.tsx
@@ -1,18 +1,21 @@
 import Link from 'next/link';
-import { FaceFrownIcon } from '@heroicons/react/24/solid';
+import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
 
 export default function NotFound() {
   return (
-    <main className="flex h-full flex-col items-center justify-center gap-2">
-      <FaceFrownIcon className="w-10 text-aura" />
-      <h2 className="text-xl font-semibold text-white">404 Not Found</h2>
-      <p className="text-aura">Could not find the requested customer.</p>
-      <Link
-        href="/dashboard/customers"
-        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
+    <main className="flex h-full flex-col items-center justify-center">
+      <CatState
+        art="asleep"
+        title="404 Not Found"
+        as="h1"
+        action={
+          <Link href="/dashboard/customers" className={catStateLinkClass}>
+            Back to the customers
+          </Link>
+        }
       >
-        Go Back
-      </Link>
+        Could not find the requested customer.
+      </CatState>
     </main>
   );
 }
diff --git a/app/dashboard/customers/error.tsx b/app/dashboard/customers/error.tsx
index 2ca5f54..6ea55a4 100644
--- a/app/dashboard/customers/error.tsx
+++ b/app/dashboard/customers/error.tsx
@@ -1,27 +1,7 @@
 'use client';
 
-import { useEffect } from 'react';
+import CatError from '@/app/ui/cat-error';
 
-export default function Error({
-  error,
-  reset,
-}: {
-  error: Error & { digest?: string };
-  reset: () => void;
-}) {
-  useEffect(() => {
-    console.error(error);
-  }, [error]);
-
-  return (
-    <main className="flex h-full flex-col items-center justify-center">
-      <h2 className="text-center text-lg font-semibold text-white">Something went wrong!</h2>
-      <button
-        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
-        onClick={() => reset()}
-      >
-        Try again
-      </button>
-    </main>
-  );
+export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
+  return <CatError {...props} />;
 }
diff --git a/app/dashboard/error.tsx b/app/dashboard/error.tsx
new file mode 100644
index 0000000..6ea55a4
--- /dev/null
+++ b/app/dashboard/error.tsx
@@ -0,0 +1,7 @@
+'use client';
+
+import CatError from '@/app/ui/cat-error';
+
+export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
+  return <CatError {...props} />;
+}
diff --git a/app/dashboard/invoices/[id]/edit/not-found.tsx b/app/dashboard/invoices/[id]/edit/not-found.tsx
index 16338aa..69e59ad 100644
--- a/app/dashboard/invoices/[id]/edit/not-found.tsx
+++ b/app/dashboard/invoices/[id]/edit/not-found.tsx
@@ -1,18 +1,21 @@
 import Link from 'next/link';
-import { FaceFrownIcon } from '@heroicons/react/24/solid';
+import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
 
 export default function NotFound() {
   return (
-    <main className="flex h-full flex-col items-center justify-center gap-2">
-      <FaceFrownIcon className="w-10 text-aura" />
-      <h2 className="text-xl font-semibold text-white">404 Not Found</h2>
-      <p className="text-aura">Could not find the requested invoice.</p>
-      <Link
-        href="/dashboard/invoices"
-        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
+    <main className="flex h-full flex-col items-center justify-center">
+      <CatState
+        art="asleep"
+        title="404 Not Found"
+        as="h1"
+        action={
+          <Link href="/dashboard/invoices" className={catStateLinkClass}>
+            Back to the invoices
+          </Link>
+        }
       >
-        Go Back
-      </Link>
+        Could not find the requested invoice.
+      </CatState>
     </main>
   );
 }
diff --git a/app/dashboard/invoices/[id]/not-found.tsx b/app/dashboard/invoices/[id]/not-found.tsx
index 16338aa..69e59ad 100644
--- a/app/dashboard/invoices/[id]/not-found.tsx
+++ b/app/dashboard/invoices/[id]/not-found.tsx
@@ -1,18 +1,21 @@
 import Link from 'next/link';
-import { FaceFrownIcon } from '@heroicons/react/24/solid';
+import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
 
 export default function NotFound() {
   return (
-    <main className="flex h-full flex-col items-center justify-center gap-2">
-      <FaceFrownIcon className="w-10 text-aura" />
-      <h2 className="text-xl font-semibold text-white">404 Not Found</h2>
-      <p className="text-aura">Could not find the requested invoice.</p>
-      <Link
-        href="/dashboard/invoices"
-        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
+    <main className="flex h-full flex-col items-center justify-center">
+      <CatState
+        art="asleep"
+        title="404 Not Found"
+        as="h1"
+        action={
+          <Link href="/dashboard/invoices" className={catStateLinkClass}>
+            Back to the invoices
+          </Link>
+        }
       >
-        Go Back
-      </Link>
+        Could not find the requested invoice.
+      </CatState>
     </main>
   );
 }
diff --git a/app/dashboard/invoices/error.tsx b/app/dashboard/invoices/error.tsx
index 2ca5f54..6ea55a4 100644
--- a/app/dashboard/invoices/error.tsx
+++ b/app/dashboard/invoices/error.tsx
@@ -1,27 +1,7 @@
 'use client';
 
-import { useEffect } from 'react';
+import CatError from '@/app/ui/cat-error';
 
-export default function Error({
-  error,
-  reset,
-}: {
-  error: Error & { digest?: string };
-  reset: () => void;
-}) {
-  useEffect(() => {
-    console.error(error);
-  }, [error]);
-
-  return (
-    <main className="flex h-full flex-col items-center justify-center">
-      <h2 className="text-center text-lg font-semibold text-white">Something went wrong!</h2>
-      <button
-        className="mt-4 rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow"
-        onClick={() => reset()}
-      >
-        Try again
-      </button>
-    </main>
-  );
+export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
+  return <CatError {...props} />;
 }
diff --git a/app/not-found.tsx b/app/not-found.tsx
new file mode 100644
index 0000000..29c70de
--- /dev/null
+++ b/app/not-found.tsx
@@ -0,0 +1,31 @@
+import { Metadata } from 'next';
+import Link from 'next/link';
+import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
+import XenocatLogo from '@/app/ui/xenocat-logo';
+
+export const metadata: Metadata = {
+  title: 'Not found',
+};
+
+/** Any address the app does not have, inside or outside the dashboard. */
+export default function NotFound() {
+  return (
+    <main className="xenocat-stars flex min-h-screen flex-col items-center justify-center bg-void-landing px-4 py-10">
+      <Link href="/" aria-label="Xenocat Analytics home" className="mb-10">
+        <XenocatLogo />
+      </Link>
+      <CatState
+        art="asleep"
+        title="404 Not Found"
+        as="h1"
+        action={
+          <Link href="/" className={catStateLinkClass}>
+            Back to the home page
+          </Link>
+        }
+      >
+        This page has drifted off into space, and a cat has fallen asleep where it was.
+      </CatState>
+    </main>
+  );
+}
diff --git a/app/ui/cat-error.tsx b/app/ui/cat-error.tsx
new file mode 100644
index 0000000..60b6370
--- /dev/null
+++ b/app/ui/cat-error.tsx
@@ -0,0 +1,34 @@
+'use client';
+
+import { useEffect } from 'react';
+import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
+
+/** The dashboard's error state (each error.tsx renders it): logs, and offers a retry. */
+export default function CatError({
+  error,
+  reset,
+}: {
+  error: Error & { digest?: string };
+  reset: () => void;
+}) {
+  useEffect(() => {
+    console.error(error);
+  }, [error]);
+
+  return (
+    <main className="flex h-full flex-col items-center justify-center">
+      <CatState
+        art="peeking"
+        title="Something went wrong!"
+        as="h1"
+        action={
+          <button type="button" className={catStateLinkClass} onClick={() => reset()}>
+            Try again
+          </button>
+        }
+      >
+        A cat got into the wiring. Try again; if it keeps happening, come back in a while.
+      </CatState>
+    </main>
+  );
+}
diff --git a/app/ui/cat-state.tsx b/app/ui/cat-state.tsx
new file mode 100644
index 0000000..534f072
--- /dev/null
+++ b/app/ui/cat-state.tsx
@@ -0,0 +1,52 @@
+import Image from 'next/image';
+import type { ReactNode } from 'react';
+
+// The cats' own artwork for the dashboard's not-found, error and empty states.
+// Decorative: the heading and the text carry the meaning, so the images are hidden
+// from assistive technology like the rest of the cats.
+const ART = {
+  /** Not found: the page has drifted off, and a cat has fallen asleep in its place. */
+  asleep: { src: '/xenocats/cat-sleeping.webp', width: 1173, height: 481, className: 'w-64' },
+  /** Something went wrong: a cat peeks in to see what broke. */
+  peeking: { src: '/xenocats/cat-login-peek.webp', width: 131, height: 113, className: 'w-24' },
+  /** Nothing matched: a cat peers at the empty space. */
+  empty: { src: '/xenocats/cat-peek.webp', width: 114, height: 113, className: 'w-20' },
+} as const;
+
+export default function CatState({
+  art,
+  title,
+  children,
+  action,
+  as: Heading = 'h2',
+}: {
+  art: keyof typeof ART;
+  title: string;
+  /** What happened, in a sentence or two. */
+  children: ReactNode;
+  /** A link or button that leads on. */
+  action?: ReactNode;
+  /** h1 where the state is the whole page; h3 inside a card titled h2. */
+  as?: 'h1' | 'h2' | 'h3';
+}) {
+  const image = ART[art];
+  return (
+    <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
+      <Image
+        src={image.src}
+        alt=""
+        aria-hidden
+        width={image.width}
+        height={image.height}
+        className={`${image.className} pointer-events-none mb-2 h-auto`}
+      />
+      <Heading className="text-xl font-semibold text-white">{title}</Heading>
+      <div className="max-w-md text-aura">{children}</div>
+      {action && <div className="mt-4">{action}</div>}
+    </div>
+  );
+}
+
+/** The plasma button-link the states lead on with. */
+export const catStateLinkClass =
+  'rounded-xl bg-plasma px-4 py-2 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma';
diff --git a/app/ui/customers/table.tsx b/app/ui/customers/table.tsx
index 3d45b27..400acaf 100644
--- a/app/ui/customers/table.tsx
+++ b/app/ui/customers/table.tsx
@@ -1,3 +1,4 @@
+import CatState from '@/app/ui/cat-state';
 import CustomerAvatar from '@/app/ui/customer-avatar';
 import { DeleteCustomer, UpdateCustomer } from '@/app/ui/customers/buttons';
 import { FormattedCustomersTable } from '@/app/lib/definitions';
@@ -96,7 +97,10 @@ export default function CustomersTable({ customers }: { customers: FormattedCust
               </tbody>
             </table>
             {customers.length === 0 && (
-              <p className="px-4 py-8 text-center text-sm text-aura">No customers found.</p>
+              <CatState art="empty" title="No customers found">
+                No customers to show here. If a search is set, try fewer letters, or another name or
+                email.
+              </CatState>
             )}
           </div>
         </div>
diff --git a/app/ui/dashboard/latest-invoices.tsx b/app/ui/dashboard/latest-invoices.tsx
index 5d2363b..fd63fb7 100644
--- a/app/ui/dashboard/latest-invoices.tsx
+++ b/app/ui/dashboard/latest-invoices.tsx
@@ -1,3 +1,4 @@
+import CatState from '@/app/ui/cat-state';
 import CustomerAvatar from '@/app/ui/customer-avatar';
 import InvoiceStatus from '@/app/ui/invoices/status';
 import { fetchLatestInvoices } from '@/app/lib/data';
@@ -35,6 +36,11 @@ export default async function LatestInvoices() {
           </li>
         ))}
       </ul>
+      {latestInvoices.length === 0 && (
+        <CatState art="empty" title="No invoices yet" as="h3">
+          Invoices appear here as soon as one is created.
+        </CatState>
+      )}
     </div>
   );
 }
diff --git a/app/ui/invoices/table.tsx b/app/ui/invoices/table.tsx
index 9ce1ea0..bef776f 100644
--- a/app/ui/invoices/table.tsx
+++ b/app/ui/invoices/table.tsx
@@ -1,3 +1,4 @@
+import CatState from '@/app/ui/cat-state';
 import CustomerAvatar from '@/app/ui/customer-avatar';
 import { DeleteInvoice, UpdateInvoice, ViewInvoice } from '@/app/ui/invoices/buttons';
 import InvoiceStatus from '@/app/ui/invoices/status';
@@ -105,6 +106,12 @@ export default async function InvoicesTable({
               ))}
             </tbody>
           </table>
+          {invoices.length === 0 && (
+            <CatState art="empty" title="No invoices found">
+              No invoices to show here. If a search or a status is set, try another, or All
+              statuses.
+            </CatState>
+          )}
         </div>
       </div>
     </div>
diff --git a/tests/e2e/cat-states.spec.ts b/tests/e2e/cat-states.spec.ts
new file mode 100644
index 0000000..0ea4f86
--- /dev/null
+++ b/tests/e2e/cat-states.spec.ts
@@ -0,0 +1,56 @@
+import { type Page, expect, test } from '@playwright/test';
+
+// The cat-themed not-found and empty states. Each shows its cat (decorative, so
+// hidden from assistive technology), a heading, what happened, and a way on.
+// The error state is a unit test (tests/unit/cat-error.test.tsx): it cannot be
+// caused on purpose here.
+
+/** The state's cat: an image of the given artwork, with no text alternative. */
+async function expectCat(page: Page, artwork: string) {
+  const cat = page.locator(`img[src*="${artwork}"]`).first();
+  await expect(cat).toBeVisible();
+  await expect(cat).toHaveAttribute('alt', '');
+  await expect(cat).toHaveAttribute('aria-hidden', 'true');
+}
+
+test('an address the app does not have gets the cat 404, with a way home', async ({ page }) => {
+  const response = await page.goto('/no-such-place');
+  expect(response?.status()).toBe(404);
+  await expect(page.getByRole('heading', { level: 1, name: '404 Not Found' })).toBeVisible();
+  await expectCat(page, 'cat-sleeping');
+  await page.getByRole('link', { name: 'Back to the home page' }).click();
+  await expect(page).toHaveURL(/\/$/);
+});
+
+test.describe('logged in', () => {
+  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+  test.beforeEach(async ({ page }) => {
+    await page.goto('/login');
+    await page.waitForLoadState('networkidle');
+    await page.getByLabel('Email').fill('user@nextmail.com');
+    await page.getByLabel('Password', { exact: true }).fill('123456');
+    await page.getByRole('button', { name: /log in/i }).click();
+    await expect(page).toHaveURL(/\/dashboard$/);
+  });
+
+  test('an invoice that does not exist gets the cat 404, with a way back', async ({ page }) => {
+    await page.goto('/dashboard/invoices/00000000-0000-4000-8000-000000000000');
+    await expect(page.getByText('Could not find the requested invoice.')).toBeVisible();
+    // The state is the whole page: its heading is the page's h1.
+    await expect(page.getByRole('heading', { level: 1, name: '404 Not Found' })).toBeVisible();
+    await expectCat(page, 'cat-sleeping');
+    await page.getByRole('link', { name: 'Back to the invoices' }).click();
+    await expect(page).toHaveURL(/\/dashboard\/invoices$/);
+  });
+
+  test('a search that finds nothing says so, with a cat, in both lists', async ({ page }) => {
+    const nothing = `nothing-${Date.now().toString(36)}`;
+    await page.goto(`/dashboard/invoices?query=${nothing}`);
+    await expect(page.getByRole('heading', { name: 'No invoices found' })).toBeVisible();
+    await expectCat(page, 'cat-peek');
+    await page.goto(`/dashboard/customers?query=${nothing}`);
+    await expect(page.getByRole('heading', { name: 'No customers found' })).toBeVisible();
+    await expectCat(page, 'cat-peek');
+  });
+});
diff --git a/tests/unit/cat-error.test.tsx b/tests/unit/cat-error.test.tsx
new file mode 100644
index 0000000..4a87964
--- /dev/null
+++ b/tests/unit/cat-error.test.tsx
@@ -0,0 +1,31 @@
+// @vitest-environment jsdom
+import { cleanup, fireEvent, render, screen } from '@testing-library/react';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import CatError from '@/app/ui/cat-error';
+
+// The dashboard's error state (each error.tsx renders it). The not-found and
+// empty states are walked in a browser (tests/e2e/cat-states.spec.ts); an error
+// cannot be caused there on purpose.
+afterEach(() => cleanup());
+
+describe('CatError', () => {
+  it('says something went wrong, with a cat, and Try again calls reset', () => {
+    const reset = vi.fn();
+    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
+    render(<CatError error={new Error('boom')} reset={reset} />);
+
+    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong!' })).toBeTruthy();
+    // The cat is decoration: present, but hidden from assistive technology.
+    const cat = document.querySelector('img')!;
+    expect(cat.getAttribute('src')).toContain('cat-login-peek');
+    expect(cat.getAttribute('alt')).toBe('');
+    expect(cat.getAttribute('aria-hidden')).toBe('true');
+    // The error goes to the console (as before), not on the page.
+    expect(error).toHaveBeenCalled();
+    expect(document.body.textContent).not.toContain('boom');
+
+    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
+    expect(reset).toHaveBeenCalledTimes(1);
+    error.mockRestore();
+  });
+});
~~~~

</details>

#### T23 — `night-2026-10-01-t23-keyboard-a11y`

**What the code does**

- **Skip link** first in the tab order on every dashboard page (layout) and
  on `/cats`; shown when focused; moves focus to the page's content. The
  dashboard layout now holds the single `<main>` landmark (ten pages and the
  error state had their own, two none; theirs became `<div>`s).
- **Visible focus**: a base `:focus-visible` style (2px lime outline) in
  `global.css` for everything without a focus style of its own.
- **Names**: the pagination arrows ("Previous page" / "Next page"); at phone
  width the navigation links, Sign out and the Create Invoice / Create
  Customer links had their only text `display:none` — now `sr-only` below
  `md`.
- `tests/e2e/keyboard.spec.ts` (new, 3 tests, in CI): `/cats` and the
  dashboard by keyboard only (skip link, a visible focus ring at every Tab
  stop, a cat summoned with Enter, the keyboard unaffected with a cat on
  screen, navigation and search by keyboard); every visible control on five
  dashboard pages named, also at 390×844.

**Why**: plan task 23. Design: D31.

<details><summary>Code:  21 files changed, 229 insertions(+), 36 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index e46a355..f9e1191 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -107,12 +107,12 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard, login, settings, headers, states)
+      - name: Browser tests against next start (smoke, branding, dashboard, login, settings, headers, states, keyboard)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           tests/e2e/change-password
-          tests/e2e/security-headers tests/e2e/cat-states
+          tests/e2e/security-headers tests/e2e/cat-states tests/e2e/keyboard
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -199,12 +199,12 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard, login, settings, headers, states)
+      - name: Browser tests (smoke, branding, dashboard, login, settings, headers, states, keyboard)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           tests/e2e/change-password
-          tests/e2e/security-headers tests/e2e/cat-states
+          tests/e2e/security-headers tests/e2e/cat-states tests/e2e/keyboard
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/app/cats/page.tsx b/app/cats/page.tsx
index d0d1104..ac66d14 100644
--- a/app/cats/page.tsx
+++ b/app/cats/page.tsx
@@ -10,6 +10,12 @@ export const metadata: Metadata = {
 export default function Page() {
   return (
     <div className="xenocat-stars min-h-screen bg-void-landing">
+      <a
+        href="#main-content"
+        className="sr-only rounded-xl bg-plasma px-4 py-2 font-semibold text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000]"
+      >
+        Skip to main content
+      </a>
       <main className="mx-auto max-w-[1366px] px-6 pb-12 pt-4 md:px-12">
         <header className="mb-12 flex items-center justify-between gap-4">
           <Link href="/" aria-label="Xenocat Analytics home">
@@ -22,7 +28,8 @@ export default function Page() {
             Back to the dashboard
           </Link>
         </header>
-        <div className="mb-6">
+        {/* The skip link's target: past the header's links, to the cats. */}
+        <div id="main-content" tabIndex={-1} className="mb-6 focus-visible:outline-none">
           <h1 className="font-display text-4xl font-semibold text-cream md:text-[52px]">
             The <span className="text-plasma">cats</span>
           </h1>
diff --git a/app/dashboard/(overview)/page.tsx b/app/dashboard/(overview)/page.tsx
index 859d723..7579d98 100644
--- a/app/dashboard/(overview)/page.tsx
+++ b/app/dashboard/(overview)/page.tsx
@@ -14,7 +14,7 @@ export const metadata: Metadata = {
 export default async function Page(props: { searchParams?: Promise<{ range?: string }> }) {
   const range = parseRange((await props.searchParams)?.range);
   return (
-    <main>
+    <div>
       <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
         <div>
           <h1>
@@ -40,6 +40,6 @@ export default async function Page(props: { searchParams?: Promise<{ range?: str
           <LatestInvoices />
         </Suspense>
       </div>
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/customers/[id]/edit/not-found.tsx b/app/dashboard/customers/[id]/edit/not-found.tsx
index 8467578..84afe55 100644
--- a/app/dashboard/customers/[id]/edit/not-found.tsx
+++ b/app/dashboard/customers/[id]/edit/not-found.tsx
@@ -3,7 +3,7 @@ import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
 
 export default function NotFound() {
   return (
-    <main className="flex h-full flex-col items-center justify-center">
+    <div className="flex h-full flex-col items-center justify-center">
       <CatState
         art="asleep"
         title="404 Not Found"
@@ -16,6 +16,6 @@ export default function NotFound() {
       >
         Could not find the requested customer.
       </CatState>
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/customers/[id]/edit/page.tsx b/app/dashboard/customers/[id]/edit/page.tsx
index f337f44..c8e63ed 100644
--- a/app/dashboard/customers/[id]/edit/page.tsx
+++ b/app/dashboard/customers/[id]/edit/page.tsx
@@ -16,7 +16,7 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
   if (!customer) notFound();
 
   return (
-    <main>
+    <div>
       <Breadcrumbs
         breadcrumbs={[
           { label: 'Customers', href: '/dashboard/customers' },
@@ -24,6 +24,6 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
         ]}
       />
       <CustomerForm customer={customer} />
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/customers/create/page.tsx b/app/dashboard/customers/create/page.tsx
index 7a206bd..f0905c4 100644
--- a/app/dashboard/customers/create/page.tsx
+++ b/app/dashboard/customers/create/page.tsx
@@ -8,7 +8,7 @@ export const metadata: Metadata = {
 
 export default function Page() {
   return (
-    <main>
+    <div>
       <Breadcrumbs
         breadcrumbs={[
           { label: 'Customers', href: '/dashboard/customers' },
@@ -16,6 +16,6 @@ export default function Page() {
         ]}
       />
       <CustomerForm />
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/invoices/[id]/edit/not-found.tsx b/app/dashboard/invoices/[id]/edit/not-found.tsx
index 69e59ad..7740dbb 100644
--- a/app/dashboard/invoices/[id]/edit/not-found.tsx
+++ b/app/dashboard/invoices/[id]/edit/not-found.tsx
@@ -3,7 +3,7 @@ import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
 
 export default function NotFound() {
   return (
-    <main className="flex h-full flex-col items-center justify-center">
+    <div className="flex h-full flex-col items-center justify-center">
       <CatState
         art="asleep"
         title="404 Not Found"
@@ -16,6 +16,6 @@ export default function NotFound() {
       >
         Could not find the requested invoice.
       </CatState>
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/invoices/[id]/edit/page.tsx b/app/dashboard/invoices/[id]/edit/page.tsx
index 5161395..e28bfc8 100644
--- a/app/dashboard/invoices/[id]/edit/page.tsx
+++ b/app/dashboard/invoices/[id]/edit/page.tsx
@@ -18,7 +18,7 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
   }
 
   return (
-    <main>
+    <div>
       <Breadcrumbs
         breadcrumbs={[
           { label: 'Invoices', href: '/dashboard/invoices' },
@@ -30,6 +30,6 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
         ]}
       />
       <Form invoice={invoice} customers={customers} />
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/invoices/[id]/not-found.tsx b/app/dashboard/invoices/[id]/not-found.tsx
index 69e59ad..7740dbb 100644
--- a/app/dashboard/invoices/[id]/not-found.tsx
+++ b/app/dashboard/invoices/[id]/not-found.tsx
@@ -3,7 +3,7 @@ import CatState, { catStateLinkClass } from '@/app/ui/cat-state';
 
 export default function NotFound() {
   return (
-    <main className="flex h-full flex-col items-center justify-center">
+    <div className="flex h-full flex-col items-center justify-center">
       <CatState
         art="asleep"
         title="404 Not Found"
@@ -16,6 +16,6 @@ export default function NotFound() {
       >
         Could not find the requested invoice.
       </CatState>
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/invoices/[id]/page.tsx b/app/dashboard/invoices/[id]/page.tsx
index 0b8b857..142a15b 100644
--- a/app/dashboard/invoices/[id]/page.tsx
+++ b/app/dashboard/invoices/[id]/page.tsx
@@ -28,7 +28,7 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
   ] as const;
 
   return (
-    <main>
+    <div>
       <Breadcrumbs
         breadcrumbs={[
           { label: 'Invoices', href: '/dashboard/invoices' },
@@ -68,6 +68,6 @@ export default async function Page(props: { params: Promise<{ id: string }> }) {
           ))}
         </dl>
       </section>
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/invoices/create/page.tsx b/app/dashboard/invoices/create/page.tsx
index 5bc0e19..1d3912b 100644
--- a/app/dashboard/invoices/create/page.tsx
+++ b/app/dashboard/invoices/create/page.tsx
@@ -15,7 +15,7 @@ export default async function Page() {
   const customers = await fetchCustomers();
 
   return (
-    <main>
+    <div>
       <Breadcrumbs
         breadcrumbs={[
           { label: 'Invoices', href: '/dashboard/invoices' },
@@ -27,6 +27,6 @@ export default async function Page() {
         ]}
       />
       <Form customers={customers} />
-    </main>
+    </div>
   );
 }
diff --git a/app/dashboard/layout.tsx b/app/dashboard/layout.tsx
index 0dd413a..5833a8f 100644
--- a/app/dashboard/layout.tsx
+++ b/app/dashboard/layout.tsx
@@ -8,13 +8,24 @@ export default function Layout({ children }: { children: React.ReactNode }) {
     <XenocatCursorProvider>
       <XenocatCatsProvider>
         <div className="flex h-screen flex-col bg-void font-ui md:flex-row md:overflow-hidden">
+          {/* First in the tab order: past the navigation, straight to the page. */}
+          <a
+            href="#main-content"
+            className="sr-only rounded-xl bg-plasma px-4 py-2 font-semibold text-void focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[10000]"
+          >
+            Skip to main content
+          </a>
           <div className="w-full flex-none md:w-[228px]">
             <SideNav />
           </div>
           <div className="grow md:overflow-y-auto">
-            <div className="min-h-full px-4 py-6 md:rounded-bl-[40px] md:border-b md:border-l md:border-line/70 md:px-8 md:py-9">
+            <main
+              id="main-content"
+              tabIndex={-1}
+              className="min-h-full px-4 py-6 focus-visible:outline-none md:rounded-bl-[40px] md:border-b md:border-l md:border-line/70 md:px-8 md:py-9"
+            >
               {children}
-            </div>
+            </main>
           </div>
         </div>
       </XenocatCatsProvider>
diff --git a/app/dashboard/settings/page.tsx b/app/dashboard/settings/page.tsx
index cce170a..c09febf 100644
--- a/app/dashboard/settings/page.tsx
+++ b/app/dashboard/settings/page.tsx
@@ -7,7 +7,7 @@ export const metadata: Metadata = {
 
 export default function Page() {
   return (
-    <main className="max-w-xl">
+    <div className="max-w-xl">
       <h1 className="mb-8 font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
         Settings
       </h1>
@@ -17,6 +17,6 @@ export default function Page() {
         </h2>
         <PasswordForm />
       </section>
-    </main>
+    </div>
   );
 }
diff --git a/app/ui/cat-error.tsx b/app/ui/cat-error.tsx
index 60b6370..fa90fde 100644
--- a/app/ui/cat-error.tsx
+++ b/app/ui/cat-error.tsx
@@ -16,7 +16,7 @@ export default function CatError({
   }, [error]);
 
   return (
-    <main className="flex h-full flex-col items-center justify-center">
+    <div className="flex h-full flex-col items-center justify-center">
       <CatState
         art="peeking"
         title="Something went wrong!"
@@ -29,6 +29,6 @@ export default function CatError({
       >
         A cat got into the wiring. Try again; if it keeps happening, come back in a while.
       </CatState>
-    </main>
+    </div>
   );
 }
diff --git a/app/ui/customers/buttons.tsx b/app/ui/customers/buttons.tsx
index 1bd8cdd..33afa3d 100644
--- a/app/ui/customers/buttons.tsx
+++ b/app/ui/customers/buttons.tsx
@@ -11,7 +11,8 @@ export function CreateCustomer() {
       href="/dashboard/customers/create"
       className="flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
     >
-      <span className="hidden md:block">Create Customer</span> <PlusIcon className="h-5 md:ml-4" />
+      <span className="sr-only md:not-sr-only">Create Customer</span>{' '}
+      <PlusIcon className="h-5 md:ml-4" />
     </Link>
   );
 }
diff --git a/app/ui/dashboard/nav-links.tsx b/app/ui/dashboard/nav-links.tsx
index 4e537e9..2556dbf 100644
--- a/app/ui/dashboard/nav-links.tsx
+++ b/app/ui/dashboard/nav-links.tsx
@@ -36,7 +36,8 @@ export default function NavLinks() {
               <span className="absolute -left-4 top-1/2 hidden h-12 w-1.5 -translate-y-1/2 rounded-r-full bg-plasma shadow-[0_0_14px_rgba(193,232,56,0.7)] md:block" />
             )}
             <LinkIcon className="w-7" />
-            <p className="hidden md:block">{link.name}</p>
+            {/* Text only from md up, but always the link's name. */}
+            <p className="sr-only md:not-sr-only">{link.name}</p>
           </Link>
         );
       })}
diff --git a/app/ui/dashboard/sidenav.tsx b/app/ui/dashboard/sidenav.tsx
index d4fe681..9d8dd86 100644
--- a/app/ui/dashboard/sidenav.tsx
+++ b/app/ui/dashboard/sidenav.tsx
@@ -24,7 +24,7 @@ export default function SideNav() {
         >
           <button className={navLinkClass}>
             <ArrowRightStartOnRectangleIcon className="w-7" />
-            <div className="hidden md:block">Sign out</div>
+            <div className="sr-only md:not-sr-only">Sign out</div>
           </button>
         </form>
       </div>
diff --git a/app/ui/global.css b/app/ui/global.css
index 57c8e54..522ae6f 100644
--- a/app/ui/global.css
+++ b/app/ui/global.css
@@ -15,6 +15,11 @@
   ::selection {
     @apply bg-plasma text-black;
   }
+
+  /* Keyboard focus is always visible: a lime ring, unless a control draws its own. */
+  :focus-visible {
+    @apply outline outline-2 outline-offset-2 outline-plasma;
+  }
 }
 
 /* A scatter of stars for the public pages, layered over their background colour. */
diff --git a/app/ui/invoices/buttons.tsx b/app/ui/invoices/buttons.tsx
index 917d635..999d2d6 100644
--- a/app/ui/invoices/buttons.tsx
+++ b/app/ui/invoices/buttons.tsx
@@ -9,7 +9,8 @@ export function CreateInvoice() {
       href="/dashboard/invoices/create"
       className="flex h-10 items-center rounded-xl bg-plasma px-4 text-sm font-semibold text-void transition hover:shadow-glow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plasma"
     >
-      <span className="hidden md:block">Create Invoice</span> <PlusIcon className="h-5 md:ml-4" />
+      <span className="sr-only md:not-sr-only">Create Invoice</span>{' '}
+      <PlusIcon className="h-5 md:ml-4" />
     </Link>
   );
 }
diff --git a/app/ui/invoices/pagination.tsx b/app/ui/invoices/pagination.tsx
index 112204c..dc95e61 100644
--- a/app/ui/invoices/pagination.tsx
+++ b/app/ui/invoices/pagination.tsx
@@ -110,12 +110,20 @@ function PaginationArrow({
   );
 
   const icon =
-    direction === 'left' ? <ArrowLeftIcon className="w-4" /> : <ArrowRightIcon className="w-4" />;
+    direction === 'left' ? (
+      <ArrowLeftIcon className="w-4" aria-hidden />
+    ) : (
+      <ArrowRightIcon className="w-4" aria-hidden />
+    );
+  // Icon-only: the name says where it leads.
+  const label = direction === 'left' ? 'Previous page' : 'Next page';
 
   return isDisabled ? (
-    <div className={className}>{icon}</div>
+    <div className={className} aria-hidden>
+      {icon}
+    </div>
   ) : (
-    <Link className={className} href={href}>
+    <Link className={className} href={href} aria-label={label}>
       {icon}
     </Link>
   );
diff --git a/tests/e2e/keyboard.spec.ts b/tests/e2e/keyboard.spec.ts
new file mode 100644
index 0000000..5ffd24a
--- /dev/null
+++ b/tests/e2e/keyboard.spec.ts
@@ -0,0 +1,159 @@
+import { type Page, expect, test } from '@playwright/test';
+
+// The dashboard and /cats by keyboard only: a skip link first, a visible focus
+// ring on everything Tab reaches, and every control named. The cats never touch
+// the keyboard (a plan-wide rule), so these tests do not wait for them to leave.
+
+/**
+ * Whether the focused element shows that it has focus the way the app draws it:
+ * a solid, opaque outline at least 2px wide (the base :focus-visible rule, or a
+ * control's own) — not the browser's default ring, nor Tailwind's transparent
+ * `outline-none` — or, for a form field, its focus ring (a box-shadow).
+ */
+const focusShows = (page: Page) =>
+  page.evaluate(() => {
+    const element = document.activeElement as HTMLElement | null;
+    if (!element || element === document.body) return false;
+    const style = getComputedStyle(element);
+    const transparent = /rgba\([^)]*,\s*0\)$/.test(style.outlineColor);
+    const outline =
+      style.outlineStyle === 'solid' && parseFloat(style.outlineWidth) >= 2 && !transparent;
+    const field = element.matches('input, select, textarea');
+    return outline || (field && style.boxShadow !== 'none');
+  });
+
+const focused = (page: Page) =>
+  page.evaluate(() => {
+    const element = document.activeElement as HTMLElement;
+    return {
+      id: element.id,
+      testId: element.dataset.testid ?? '',
+      text: (element.getAttribute('aria-label') ?? element.textContent ?? '').trim(),
+      tag: element.tagName,
+    };
+  });
+
+/** Presses Tab until `match` holds for the focused element (each stop must show focus). */
+async function tabTo(page: Page, match: (f: Awaited<ReturnType<typeof focused>>) => boolean) {
+  for (let presses = 0; presses < 60; presses++) {
+    await page.keyboard.press('Tab');
+    expect(await focusShows(page), JSON.stringify(await focused(page))).toBe(true);
+    if (match(await focused(page))) return;
+  }
+  throw new Error('Tab never reached the element');
+}
+
+/** The skip link comes first, shows itself on focus, and moves focus into the page. */
+async function useSkipLink(page: Page) {
+  await page.keyboard.press('Tab');
+  const skip = page.getByRole('link', { name: 'Skip to main content' });
+  await expect(skip).toBeFocused();
+  await expect(skip).toBeInViewport();
+  // It draws no focus style of its own: this is the base :focus-visible rule.
+  expect(await focusShows(page)).toBe(true);
+  await page.keyboard.press('Enter');
+  await expect.poll(async () => (await focused(page)).id).toBe('main-content');
+}
+
+/** Every visible link, button and field has an accessible name. */
+async function expectEveryControlNamed(page: Page) {
+  const controls = page.locator(
+    'a[href]:visible, button:visible, input:not([type=hidden]):visible, select:visible, textarea:visible'
+  );
+  const count = await controls.count();
+  expect(count).toBeGreaterThan(0);
+  for (let i = 0; i < count; i++) {
+    const control = controls.nth(i);
+    const html = (await control.evaluate((element) => element.outerHTML)).slice(0, 200);
+    await expect(control, `${page.url()}: ${html}`).toHaveAccessibleName(/\S/);
+  }
+}
+
+test('/cats by keyboard: skip link, focus rings, and a cat summoned with Enter', async ({
+  page,
+}) => {
+  await page.setViewportSize({ width: 1280, height: 800 });
+  await page.goto('/cats');
+  await page.waitForLoadState('networkidle');
+  await useSkipLink(page);
+
+  // From the cats' introduction, Tab reaches the first Summon button.
+  await tabTo(page, (f) => f.testId.startsWith('summon-'));
+  await page.keyboard.press('Enter');
+  await expect(page.getByTestId('xenocat')).toBeVisible();
+
+  // With a cat on screen, the keyboard still moves focus.
+  const before = await focused(page);
+  await page.keyboard.press('Tab');
+  expect(await focused(page)).not.toEqual(before);
+  expect(await focusShows(page)).toBe(true);
+
+  await expectEveryControlNamed(page);
+});
+
+test.describe('logged in', () => {
+  test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+  test('the dashboard by keyboard: skip link, navigation and search', async ({ page }) => {
+    test.setTimeout(60_000);
+    await page.goto('/login');
+    await page.waitForLoadState('networkidle');
+    await page.getByLabel('Email').fill('user@nextmail.com');
+    await page.getByLabel('Password', { exact: true }).fill('123456');
+    await page.getByLabel('Password', { exact: true }).press('Enter');
+    await expect(page).toHaveURL(/\/dashboard$/);
+    await page.goto('/dashboard');
+    await page.waitForLoadState('networkidle');
+
+    // The skip link lands in the page, past the navigation.
+    await useSkipLink(page);
+    await page.keyboard.press('Tab');
+    expect(await page.evaluate(() => !!document.activeElement?.closest('#main-content'))).toBe(
+      true
+    );
+
+    // From the top, the navigation leads to the invoices by Tab and Enter.
+    await page.goto('/dashboard');
+    await page.waitForLoadState('networkidle');
+    await tabTo(page, (f) => f.tag === 'A' && f.text === 'Invoices');
+    await page.keyboard.press('Enter');
+    await expect(page).toHaveURL(/\/dashboard\/invoices$/);
+    await page.waitForLoadState('networkidle');
+
+    // And on to the search, typed into without the mouse.
+    await tabTo(page, (f) => f.id === 'search');
+    await page.keyboard.type('Amy');
+    await expect(page).toHaveURL(/query=Amy/);
+  });
+
+  test('every control on the dashboard pages has a name', async ({ page }) => {
+    test.setTimeout(60_000);
+    await page.goto('/login');
+    await page.waitForLoadState('networkidle');
+    await page.getByLabel('Email').fill('user@nextmail.com');
+    await page.getByLabel('Password', { exact: true }).fill('123456');
+    await page.getByRole('button', { name: /log in/i }).click();
+    await expect(page).toHaveURL(/\/dashboard$/);
+    for (const path of [
+      '/dashboard',
+      '/dashboard/invoices',
+      '/dashboard/customers',
+      '/dashboard/invoices/create',
+      '/dashboard/settings',
+    ]) {
+      await page.goto(path);
+      await page.waitForLoadState('networkidle');
+      await expectEveryControlNamed(page);
+    }
+
+    // At phone width the navigation shows icons only: still named.
+    await page.setViewportSize({ width: 390, height: 844 });
+    for (const path of ['/dashboard', '/dashboard/invoices']) {
+      await page.goto(path);
+      await page.waitForLoadState('networkidle');
+      await expectEveryControlNamed(page);
+    }
+    await expect(page.getByRole('link', { name: 'Customers' })).toBeVisible();
+    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
+  });
+});
~~~~

</details>

#### T24 — `night-2026-10-01-t24-cat-intensity`

**What the code does**

- `app/ui/xenocats/intensity.ts` (new): calm (at most 2 cats, slow), normal
  (exactly as before), chaos (at most 5, fast). Stored in `localStorage`
  (`xenocats:intensity`); unknown values read as normal. No zero level.
- `app/ui/xenocats/cat-engine.ts`: `configure()` changes how often and how
  many at run time, never above five or below one.
- `app/ui/xenocats/cat-layer.tsx`: on the dashboard (where cats come by
  themselves) the engine follows the stored level, live and across tabs;
  `/cats` is unaffected.
- `app/dashboard/settings/page.tsx`, `app/ui/settings/cat-intensity.tsx`
  (new): a "Cat intensity" radio group on the Settings page.
- Tests:
  - unit (`intensity.test.ts`): the levels; the engine holds 2, 5 and 5 cats
    at the three levels; the clamp; first-cat timing per level; storage.
  - browser (`intensity.spec.ts`): choose chaos, which is stored,
    remembered, and gives two cats within 9.5 s (only chaos can); calm by
    arrow keys, and back.
  - Both are in CI.

**Why**: plan task 24. Design: D32.

<details><summary>Code:  8 files changed, 354 insertions(+), 4 deletions(-)</summary>

~~~~diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index f9e1191..67d837a 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -38,7 +38,7 @@ jobs:
         run: >-
           npx vitest run tests/unit/xenocats/random tests/unit/xenocats/effects
           tests/unit/xenocats/cursor-controller tests/unit/xenocats/cat-engine
-          tests/unit/xenocats/cat-types
+          tests/unit/xenocats/cat-types tests/unit/xenocats/intensity
       - name: Unit tests (cats, jsdom)
         if: ${{ !cancelled() }}
         run: >-
@@ -107,12 +107,13 @@ jobs:
       # so a failure is identifiable from the job's step names alone (but not when
       # the build or the browser install failed). Each keeps its own report and
       # traces: a Playwright run clears the previous run's.
-      - name: Browser tests against next start (smoke, branding, dashboard, login, settings, headers, states, keyboard)
+      - name: Browser tests against next start (smoke, branding, dashboard, login, settings, headers, states, keyboard, intensity)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           tests/e2e/change-password
           tests/e2e/security-headers tests/e2e/cat-states tests/e2e/keyboard
+          tests/e2e/intensity
           --output test-results/smoke
         env:
           E2E_SERVER: start
@@ -199,12 +200,13 @@ jobs:
         run: npx playwright install --with-deps chromium
       # Needs no db:migrate: the tests rebuild their own xenocats_test schema. Named
       # groups, each with its own report and traces, as in the build job.
-      - name: Browser tests (smoke, branding, dashboard, login, settings, headers, states, keyboard)
+      - name: Browser tests (smoke, branding, dashboard, login, settings, headers, states, keyboard, intensity)
         if: ${{ !cancelled() && steps.install.outcome == 'success' }}
         run: >-
           npx playwright test tests/e2e/smoke tests/e2e/branding tests/e2e/dashboard tests/e2e/login-limit
           tests/e2e/change-password
           tests/e2e/security-headers tests/e2e/cat-states tests/e2e/keyboard
+          tests/e2e/intensity
           --output test-results/smoke
         env:
           PLAYWRIGHT_HTML_OUTPUT_DIR: playwright-report/smoke
diff --git a/app/dashboard/settings/page.tsx b/app/dashboard/settings/page.tsx
index c09febf..ac01fc8 100644
--- a/app/dashboard/settings/page.tsx
+++ b/app/dashboard/settings/page.tsx
@@ -1,4 +1,5 @@
 import { Metadata } from 'next';
+import CatIntensity from '@/app/ui/settings/cat-intensity';
 import PasswordForm from '@/app/ui/settings/password-form';
 
 export const metadata: Metadata = {
@@ -11,6 +12,15 @@ export default function Page() {
       <h1 className="mb-8 font-display text-3xl font-black uppercase text-plasma md:text-[40px]">
         Settings
       </h1>
+      <section aria-labelledby="intensity-heading" className="mb-10">
+        <h2 id="intensity-heading" className="mb-1 text-xl font-semibold text-white">
+          Cat intensity
+        </h2>
+        <p className="mb-4 text-sm text-aura">
+          How often the cats come, and how many at once. Saved in this browser.
+        </p>
+        <CatIntensity />
+      </section>
       <section aria-labelledby="password-heading">
         <h2 id="password-heading" className="mb-4 text-xl font-semibold text-white">
           Change password
diff --git a/app/ui/settings/cat-intensity.tsx b/app/ui/settings/cat-intensity.tsx
new file mode 100644
index 0000000..fa75ff7
--- /dev/null
+++ b/app/ui/settings/cat-intensity.tsx
@@ -0,0 +1,52 @@
+'use client';
+
+import { useSyncExternalStore } from 'react';
+import clsx from 'clsx';
+import {
+  INTENSITIES,
+  INTENSITY_LABELS,
+  type Intensity,
+  getIntensity,
+  setIntensity,
+  subscribeIntensity,
+} from '@/app/ui/xenocats/intensity';
+
+const DESCRIPTIONS: Record<Intensity, string> = {
+  calm: 'Now and then, at most two at once.',
+  normal: 'The cats as they have always been.',
+  chaos: 'Often, and up to five at once.',
+};
+
+/** Calm, normal or chaos: how hard the cats haunt the dashboard. Saved in this browser. */
+export default function CatIntensity() {
+  const current = useSyncExternalStore(subscribeIntensity, getIntensity, () => 'normal' as const);
+  return (
+    <fieldset className="rounded-2xl border border-line bg-panel p-4 md:p-6">
+      <legend className="sr-only">Cat intensity</legend>
+      <div className="grid gap-3 sm:grid-cols-3">
+        {INTENSITIES.map((level) => (
+          <label
+            key={level}
+            className={clsx(
+              'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm',
+              level === current ? 'border-plasma bg-void/70' : 'border-line hover:border-aura'
+            )}
+          >
+            <span className="flex items-center gap-2 font-semibold text-white">
+              <input
+                type="radio"
+                name="cat-intensity"
+                value={level}
+                checked={level === current}
+                onChange={() => setIntensity(level)}
+                className="h-4 w-4 border-line bg-void text-plasma focus:ring-2 focus:ring-plasma focus:ring-offset-panel"
+              />
+              {INTENSITY_LABELS[level]}
+            </span>
+            <span className="text-aura">{DESCRIPTIONS[level]}</span>
+          </label>
+        ))}
+      </div>
+    </fieldset>
+  );
+}
diff --git a/app/ui/xenocats/cat-engine.ts b/app/ui/xenocats/cat-engine.ts
index 48219a5..b3b1783 100644
--- a/app/ui/xenocats/cat-engine.ts
+++ b/app/ui/xenocats/cat-engine.ts
@@ -174,6 +174,17 @@ export function createCatEngine(options: {
       viewport = size;
     },
 
+    /**
+     * Changes how often cats come and how many at once (the intensity setting).
+     * Never more than five, never none. The next spawn is scheduled afresh from the
+     * new timings; cats already on screen stay until they leave.
+     */
+    configure(changes: Partial<Pick<CatConfig, 'maxCats' | 'firstSpawnMs' | 'spawnEveryMs'>>) {
+      Object.assign(config, changes);
+      config.maxCats = Math.min(Math.max(1, config.maxCats), CAT_CONFIG.maxCats);
+      nextSpawnAt = null;
+    },
+
     cats(): readonly Cat[] {
       return cats;
     },
diff --git a/app/ui/xenocats/cat-layer.tsx b/app/ui/xenocats/cat-layer.tsx
index d712e1f..cf1bf2e 100644
--- a/app/ui/xenocats/cat-layer.tsx
+++ b/app/ui/xenocats/cat-layer.tsx
@@ -20,6 +20,7 @@ import type { CatConfig } from './config';
 import { strengthen } from './effects';
 import { useXenocatCursor } from './fake-cursor';
 import { recordStat } from './field-guide';
+import { INTENSITY_CONFIG, getIntensity, subscribeIntensity } from './intensity';
 import {
   type CatSounds,
   sharedSoundPlayer,
@@ -78,6 +79,20 @@ export function XenocatCatsProvider({
     })
   );
   const [cats, setCats] = useState<Cat[]>([]);
+  // How often cats come and how many at once: the visitor's setting, where cats
+  // come on their own (not where they only come when summoned). Normal is this
+  // provider's own configuration, as it was created.
+  const intensity = useSyncExternalStore(subscribeIntensity, getIntensity, () => 'normal' as const);
+  const [normal] = useState(() => ({
+    maxCats: engine.config.maxCats,
+    firstSpawnMs: engine.config.firstSpawnMs,
+    spawnEveryMs: engine.config.spawnEveryMs,
+  }));
+  useEffect(() => {
+    if (!autoSpawn) return;
+    if (intensity === 'normal' && engine.config.spawnEveryMs === normal.spawnEveryMs) return;
+    engine.configure(intensity === 'normal' ? normal : INTENSITY_CONFIG[intensity]);
+  }, [autoSpawn, engine, intensity, normal]);
   const [player] = useState(() => sharedSoundPlayer());
   // Read by the loop and the API, which should not restart when a caller passes a
   // new (equal) list.
@@ -236,7 +251,11 @@ export function XenocatCatsProvider({
 
   return (
     <CatsContext.Provider value={api}>
-      <div ref={pageRef} data-testid="xenocat-page">
+      <div
+        ref={pageRef}
+        data-testid="xenocat-page"
+        data-cat-intensity={autoSpawn ? intensity : undefined}
+      >
         {children}
       </div>
       <div
diff --git a/app/ui/xenocats/intensity.ts b/app/ui/xenocats/intensity.ts
new file mode 100644
index 0000000..27da628
--- /dev/null
+++ b/app/ui/xenocats/intensity.ts
@@ -0,0 +1,67 @@
+// How hard the cats haunt the dashboard: calm, normal or chaos — how often they
+// come and how many at once. There is no zero: the cats are not optional. Chaos
+// still keeps to the five-cat limit. Remembered in localStorage, like the sound.
+
+import { CAT_CONFIG, type CatConfig } from './config';
+
+export const INTENSITIES = ['calm', 'normal', 'chaos'] as const;
+export type Intensity = (typeof INTENSITIES)[number];
+
+export const INTENSITY_LABELS: Record<Intensity, string> = {
+  calm: 'Calm',
+  normal: 'Normal',
+  chaos: 'Chaos',
+};
+
+/** What each level changes. Normal is the cats as they have always been. */
+export const INTENSITY_CONFIG: Record<
+  Intensity,
+  Pick<CatConfig, 'maxCats' | 'firstSpawnMs' | 'spawnEveryMs'>
+> = {
+  calm: { maxCats: 2, firstSpawnMs: [10_000, 20_000], spawnEveryMs: [25_000, 45_000] },
+  normal: {
+    maxCats: CAT_CONFIG.maxCats,
+    firstSpawnMs: CAT_CONFIG.firstSpawnMs,
+    spawnEveryMs: CAT_CONFIG.spawnEveryMs,
+  },
+  chaos: { maxCats: 5, firstSpawnMs: [1_000, 3_000], spawnEveryMs: [2_500, 6_000] },
+};
+
+export const INTENSITY_KEY = 'xenocats:intensity';
+
+/** A stored or submitted value as a level: anything unknown is normal. */
+export const parseIntensity = (value: string | null | undefined): Intensity =>
+  INTENSITIES.find((level) => level === value) ?? 'normal';
+
+let memory: Intensity | null = null;
+const listeners = new Set<() => void>();
+
+/** The stored level; normal if none, or if storage is blocked. */
+export function getIntensity(): Intensity {
+  if (memory) return memory;
+  try {
+    return parseIntensity(window.localStorage.getItem(INTENSITY_KEY));
+  } catch {
+    return 'normal';
+  }
+}
+
+export function setIntensity(level: Intensity) {
+  try {
+    window.localStorage.setItem(INTENSITY_KEY, level);
+  } catch {
+    // Storage blocked: the choice lasts until the page is left.
+    memory = level;
+  }
+  for (const listener of listeners) listener();
+}
+
+/** For useSyncExternalStore: changes here or in another tab. */
+export function subscribeIntensity(onChange: () => void) {
+  listeners.add(onChange);
+  window.addEventListener('storage', onChange);
+  return () => {
+    listeners.delete(onChange);
+    window.removeEventListener('storage', onChange);
+  };
+}
diff --git a/tests/e2e/intensity.spec.ts b/tests/e2e/intensity.spec.ts
new file mode 100644
index 0000000..290e47c
--- /dev/null
+++ b/tests/e2e/intensity.spec.ts
@@ -0,0 +1,60 @@
+import { expect, test } from '@playwright/test';
+
+// The cat intensity setting on the settings page: chosen there, remembered in this
+// browser (localStorage), and applied to the dashboard's cats. Each test has a
+// browser context of its own, so its choice reaches no other test.
+test.skip(!process.env.E2E_POSTGRES_URL, 'needs a database (POSTGRES_URL)');
+
+test.beforeEach(async ({ page }) => {
+  await page.goto('/login');
+  await page.waitForLoadState('networkidle');
+  await page.getByLabel('Email').fill('user@nextmail.com');
+  await page.getByLabel('Password', { exact: true }).fill('123456');
+  await page.getByRole('button', { name: /log in/i }).click();
+  await expect(page).toHaveURL(/\/dashboard$/);
+});
+
+test('chaos is chosen on the settings page, remembered, and brings cats at once', async ({
+  page,
+}) => {
+  await page.goto('/dashboard/settings');
+  await page.waitForLoadState('networkidle');
+  const group = page.getByRole('group', { name: 'Cat intensity' });
+  // Normal until chosen otherwise; there is no "none".
+  await expect(group.getByRole('radio')).toHaveCount(3);
+  await expect(group.getByRole('radio', { name: /Normal/ })).toBeChecked();
+
+  await group.getByRole('radio', { name: /Chaos/ }).check();
+  expect(await page.evaluate(() => localStorage.getItem('xenocats:intensity'))).toBe('chaos');
+  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
+
+  // Remembered across pages and reloads.
+  await page.goto('/dashboard');
+  await page.reload();
+  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'chaos');
+  // The engine runs at chaos, not just the setting: chaos always has two cats
+  // within 9 s (the first by 3 s, the next at most 6 s later); normal never does
+  // (3 s + 7 s at the earliest), calm never (at most one before 35 s).
+  await expect
+    .poll(() => page.getByTestId('xenocat').count(), { timeout: 9_500 })
+    .toBeGreaterThanOrEqual(2);
+
+  await page.goto('/dashboard/settings');
+  await expect(
+    page.getByRole('group', { name: 'Cat intensity' }).getByRole('radio', { name: /Chaos/ })
+  ).toBeChecked();
+});
+
+test('calm is chosen by keyboard, and back to normal', async ({ page }) => {
+  await page.goto('/dashboard/settings');
+  await page.waitForLoadState('networkidle');
+  const group = page.getByRole('group', { name: 'Cat intensity' });
+  await group.getByRole('radio', { name: /Normal/ }).focus();
+  // Arrow keys move through a radio group, choosing as they go.
+  await page.keyboard.press('ArrowLeft');
+  await expect(group.getByRole('radio', { name: /Calm/ })).toBeChecked();
+  expect(await page.evaluate(() => localStorage.getItem('xenocats:intensity'))).toBe('calm');
+  await expect(page.getByTestId('xenocat-page')).toHaveAttribute('data-cat-intensity', 'calm');
+  await page.keyboard.press('ArrowRight');
+  await expect(group.getByRole('radio', { name: /Normal/ })).toBeChecked();
+});
diff --git a/tests/unit/xenocats/intensity.test.ts b/tests/unit/xenocats/intensity.test.ts
new file mode 100644
index 0000000..5ae5c0f
--- /dev/null
+++ b/tests/unit/xenocats/intensity.test.ts
@@ -0,0 +1,129 @@
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { createCatEngine, type TryAttack } from '@/app/ui/xenocats/cat-engine';
+import { CAT_TYPES } from '@/app/ui/xenocats/cat-types';
+import { CAT_CONFIG } from '@/app/ui/xenocats/config';
+import {
+  INTENSITIES,
+  INTENSITY_CONFIG,
+  INTENSITY_KEY,
+  getIntensity,
+  parseIntensity,
+  setIntensity,
+  subscribeIntensity,
+} from '@/app/ui/xenocats/intensity';
+import { createRandom } from '@/app/ui/xenocats/random';
+
+// The cat intensity setting: calm, normal or chaos.
+
+describe('the levels', () => {
+  it('normal is the cats as they were; none is zero; chaos keeps to five', () => {
+    expect(INTENSITY_CONFIG.normal).toEqual({
+      maxCats: CAT_CONFIG.maxCats,
+      firstSpawnMs: CAT_CONFIG.firstSpawnMs,
+      spawnEveryMs: CAT_CONFIG.spawnEveryMs,
+    });
+    for (const level of INTENSITIES) {
+      expect(INTENSITY_CONFIG[level].maxCats, level).toBeGreaterThan(0);
+      expect(INTENSITY_CONFIG[level].maxCats, level).toBeLessThanOrEqual(5);
+    }
+    expect(INTENSITY_CONFIG.chaos.maxCats).toBe(5);
+    // Calm comes less often than normal, chaos more often.
+    expect(INTENSITY_CONFIG.calm.spawnEveryMs[0]).toBeGreaterThan(CAT_CONFIG.spawnEveryMs[1]);
+    expect(INTENSITY_CONFIG.chaos.spawnEveryMs[1]).toBeLessThan(CAT_CONFIG.spawnEveryMs[0]);
+  });
+
+  it('anything unknown reads as normal', () => {
+    expect(parseIntensity('calm')).toBe('calm');
+    expect(parseIntensity('chaos')).toBe('chaos');
+    for (const value of [null, undefined, '', 'off', 'none', 'CHAOS']) {
+      expect(parseIntensity(value)).toBe('normal');
+    }
+  });
+});
+
+/** Cats spawned over ten simulated minutes at a level (none ever attacks). */
+function spawnsAt(level: (typeof INTENSITIES)[number]) {
+  const engine = createCatEngine({
+    random: createRandom(7),
+    types: CAT_TYPES,
+    viewport: { width: 1200, height: 800 },
+    autoSpawn: true,
+  });
+  engine.configure(INTENSITY_CONFIG[level]);
+  const never: TryAttack = () => false;
+  let most = 0;
+  for (let now = 0; now <= 600_000; now += 50) {
+    engine.tick(now, { x: 600, y: 400 }, never);
+    most = Math.max(most, engine.cats().length);
+  }
+  return most;
+}
+
+describe('the engine at each level', () => {
+  it('holds at most the level’s cats at once: 2 calm, 5 chaos', () => {
+    expect(spawnsAt('calm')).toBe(2);
+    expect(spawnsAt('normal')).toBe(5);
+    expect(spawnsAt('chaos')).toBe(5);
+  });
+
+  it('never lets a setting exceed five or reach zero', () => {
+    const engine = createCatEngine({
+      random: createRandom(1),
+      types: CAT_TYPES,
+      viewport: { width: 1200, height: 800 },
+      autoSpawn: true,
+    });
+    engine.configure({ maxCats: 50 });
+    expect(engine.config.maxCats).toBe(5);
+    engine.configure({ maxCats: 0 });
+    expect(engine.config.maxCats).toBe(1);
+  });
+
+  it('chaos brings the first cat sooner than calm', () => {
+    const firstAt = (level: (typeof INTENSITIES)[number]) => {
+      const engine = createCatEngine({
+        random: createRandom(3),
+        types: CAT_TYPES,
+        viewport: { width: 1200, height: 800 },
+        autoSpawn: true,
+      });
+      engine.configure(INTENSITY_CONFIG[level]);
+      for (let now = 0; now <= 60_000; now += 50) {
+        engine.tick(now, { x: 600, y: 400 }, () => false);
+        if (engine.cats().length > 0) return now;
+      }
+      return Infinity;
+    };
+    expect(firstAt('chaos')).toBeLessThanOrEqual(3_000);
+    expect(firstAt('calm')).toBeGreaterThanOrEqual(10_000);
+  });
+});
+
+describe('remembered in localStorage', () => {
+  afterEach(() => vi.unstubAllGlobals());
+
+  function stubWindow(storage: Partial<Storage>) {
+    const listeners: (() => void)[] = [];
+    vi.stubGlobal('window', {
+      localStorage: storage,
+      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
+      removeEventListener: () => {},
+    });
+  }
+
+  it('stores the choice and tells subscribers', () => {
+    const store = new Map<string, string>();
+    stubWindow({
+      getItem: (key) => store.get(key) ?? null,
+      setItem: (key, value) => void store.set(key, value),
+    });
+    expect(getIntensity()).toBe('normal');
+    const onChange = vi.fn();
+    const unsubscribe = subscribeIntensity(onChange);
+    setIntensity('chaos');
+    expect(store.get(INTENSITY_KEY)).toBe('chaos');
+    expect(getIntensity()).toBe('chaos');
+    expect(onChange).toHaveBeenCalledTimes(1);
+    unsubscribe();
+  });
+});
~~~~

</details>

#### T25-1 — `night-2026-10-01-t25-1-page-param`

**What the code does**

- `app/lib/utils.ts`, `parsePage` (new): a page from the URL is a whole
  number from 1 up; anything else is page 1.
- `app/dashboard/invoices/page.tsx` (server) and
  `app/ui/invoices/pagination.tsx` (client) both use it. Before,
  `Number(page) || 1` let `-1` reach the query as a negative offset, which
  PostgreSQL rejects (the page showed the error state). It also let `2.5`
  through as a fractional page.
- Tests:
  - unit: `parsePage` for whole, missing, zero, negative, fractional and
    non-numeric values;
  - browser (`invoices-filter.spec.ts`): `?page=-1`, `0`, `2.5` and `abc`
    show real rows and no error.

**Why**: plan task 25 (exploration), kind "security and quality". This is
the bug T22 found (Q11, now resolved).

<details><summary>Code:  5 files changed, 40 insertions(+), 4 deletions(-)</summary>

~~~~diff
diff --git a/app/dashboard/invoices/page.tsx b/app/dashboard/invoices/page.tsx
index 70bf004..9a6b350 100644
--- a/app/dashboard/invoices/page.tsx
+++ b/app/dashboard/invoices/page.tsx
@@ -5,6 +5,7 @@ import { CreateInvoice } from '@/app/ui/invoices/buttons';
 import { InvoicesTableSkeleton } from '@/app/ui/skeletons';
 import { Suspense } from 'react';
 import { fetchInvoicesPages } from '@/app/lib/data';
+import { parsePage } from '@/app/lib/utils';
 import { Metadata } from 'next';
 import { parseStatusFilter } from '@/app/lib/schemas';
 import StatusFilter from '@/app/ui/invoices/status-filter';
@@ -23,7 +24,7 @@ export default async function Page(props: {
 }) {
   const searchParams = await props.searchParams;
   const query = searchParams?.query || '';
-  const currentPage = Number(searchParams?.page) || 1;
+  const currentPage = parsePage(searchParams?.page);
   // Anything but a known status shows them all.
   const status = parseStatusFilter(searchParams?.status);
   const totalPages = await fetchInvoicesPages(query, status);
diff --git a/app/lib/utils.ts b/app/lib/utils.ts
index 1ec35e3..14da51a 100644
--- a/app/lib/utils.ts
+++ b/app/lib/utils.ts
@@ -40,3 +40,13 @@ export const generatePagination = (currentPage: number, totalPages: number) => {
   // another ellipsis, and the last page.
   return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
 };
+
+/**
+ * The list page in the URL (`?page=`): a whole number from 1 up. Anything else —
+ * missing, negative, zero, fractional, not a number — is page 1, so a hand-edited
+ * or stale link can never reach the query as a negative or fractional offset.
+ */
+export const parsePage = (value: string | null | undefined): number => {
+  const page = Number(value);
+  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
+};
diff --git a/app/ui/invoices/pagination.tsx b/app/ui/invoices/pagination.tsx
index dc95e61..f535847 100644
--- a/app/ui/invoices/pagination.tsx
+++ b/app/ui/invoices/pagination.tsx
@@ -3,13 +3,13 @@
 import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/20/solid';
 import clsx from 'clsx';
 import Link from 'next/link';
-import { generatePagination } from '@/app/lib/utils';
+import { generatePagination, parsePage } from '@/app/lib/utils';
 import { usePathname, useSearchParams } from 'next/navigation';
 
 export default function Pagination({ totalPages }: { totalPages: number }) {
   const pathname = usePathname();
   const searchParams = useSearchParams();
-  const currentPage = Number(searchParams.get('page')) || 1;
+  const currentPage = parsePage(searchParams.get('page'));
 
   const createPageURL = (pageNumber: number | string) => {
     const params = new URLSearchParams(searchParams);
diff --git a/tests/e2e/invoices-filter.spec.ts b/tests/e2e/invoices-filter.spec.ts
index 0592af5..42b8803 100644
--- a/tests/e2e/invoices-filter.spec.ts
+++ b/tests/e2e/invoices-filter.spec.ts
@@ -155,3 +155,15 @@ test('a new unpaid invoice is due in 30 days: pending, not overdue', async ({ pa
   await expect(page.getByText('Due', { exact: true })).toBeVisible();
   await expect(page.getByText(shown)).toHaveCount(1);
 });
+
+test('a page number that makes no sense shows the first page, not an error', async ({ page }) => {
+  await logIn(page);
+  for (const value of ['-1', '0', '2.5', 'abc']) {
+    await page.goto(`/dashboard/invoices?page=${value}`);
+    // Real rows (they show amounts; the loading skeleton does not), then no error:
+    // the list streams in after the page, and so would an error.
+    await expect(rows(page).filter({ hasText: '$' }).first()).toBeVisible();
+    await page.waitForLoadState('networkidle');
+    await expect(page.getByRole('heading', { name: 'Something went wrong!' })).toHaveCount(0);
+  }
+});
diff --git a/tests/unit/utils.test.ts b/tests/unit/utils.test.ts
index 86ecac5..4c2dd6a 100644
--- a/tests/unit/utils.test.ts
+++ b/tests/unit/utils.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { formatCurrency, formatDateToLocal, generatePagination } from '@/app/lib/utils';
+import { formatCurrency, formatDateToLocal, generatePagination, parsePage } from '@/app/lib/utils';
 
 describe('formatCurrency', () => {
   it('formats cents as US dollars', () => {
@@ -40,3 +40,16 @@ describe('generatePagination', () => {
     expect(generatePagination(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10]);
   });
 });
+
+describe('parsePage', () => {
+  it('takes a whole page number from 1 up', () => {
+    expect(parsePage('1')).toBe(1);
+    expect(parsePage('3')).toBe(3);
+  });
+
+  it('reads anything else as page 1, never a negative or fractional page', () => {
+    for (const value of [null, undefined, '', '0', '-1', '-0', '2.5', 'abc', '1e400', 'Infinity']) {
+      expect(parsePage(value), String(value)).toBe(1);
+    }
+  });
+});
~~~~

</details>


### Provisional

None.

### Abandoned

- **Checkpoint 1's CI fix.** Not a task: the checkpoint itself completed and
  merged. Three repair cycles did not make the fight browser tests pass on
  GitHub's runner. Each cycle's hypothesis and outcome are in progress.md
  (C1-CI) and Q1. The branch `night-2026-10-01-c1-checkpoint` was pushed as
  it was, and every later task's CI inherits that one failing step.

### Questions (questions.md, most consequential first)

1. **Q3: apply tonight's migrations to `xenocats` (`npm run db:migrate`).**
   This is required before running this branch's app against that schema:
   - 0002 adds the invoice key and indexes;
   - 0003 adds due dates, without which invoice reads and inserts fail;
   - 0004 adds the lockout table, without which **every login fails**.
2. **Q1: the fight browser tests fail on GitHub's runner and pass locally.**
   Three cycles were spent. The report artifact `playwright-report/fight/` of
   any CI run names the failing test.
3. **Q6: `npm test` now writes the `xenocats_vitest` schema on the
   development server.** The skill's §3 forbids that to unattended runs, and
   the checkpoint 4 reviewer rated it Medium. Two options:
   - make the database tests opt-in;
   - or name `npm test` in the skill's gate and §3.
4. **Q5:** "Pending" in the invoice list means not yet due, while the
   dashboard's pending totals count every unpaid invoice. A product
   decision.
5. **Q9:** other sessions stay logged in after a password change (JWT).
6. **Q7:** what the lockout leaves out: a per-address limit, pruning
   `login_failures`, the `LOGIN_*` settings in deployment config, and
   timing differences.
7. **Q8:** a nonce-based CSP, so scripts no longer need `'unsafe-inline'`.
8. **Q2:** indexes for the substring searches (needs `pg_trgm` and a query
   change).
9. **Q4:** editable payment terms. Proposed task.
10. **Q10:** drop the unused `revenue` table. Proposed task.
11. **Q11: resolved by T25-1** (a nonsense `?page=` crashed the invoice list).

### Clock and budget

- **Start:** 2026-10-01 14:45, budget 14,917,242 tokens.
- **Report start:** 2026-10-02 07:20, budget about 13.35M.
- Each task's start and completion clock and budget are in its entry.
  Nothing ran past the deadline.
- **Gaps with no activity:**
  - about 17:45–19:49 during checkpoint 1's CI cycles;
  - about 21:55–00:49 during T12;
  - 03:49–05:49 during T19.

  Each was resumed by the timer.

### State

- **Run branch:** `night-2026-10-01`. Its tip is the commit of this report.
  Before the report it was `4b98d0a`, 33 commits ahead of `main`.
- **On the remote:** every task and checkpoint branch, all listed in the
  table above, plus the run branch.
- **Uncommitted:** nothing.
- **Build:** in the gate for the whole run.
- **Lint:** 0 warnings, against a baseline of 0.
- **`next-env.d.ts`** is no longer tracked (T20). Checking out the branch
  deletes the local copy; `npm run dev`, `next build` or `npx next typegen`
  writes it again.
- **`npm test`** writes a database schema when `.env` has a `POSTGRES_URL`;
  `E2E_NO_DATABASE=1` skips that (Q6).

### What nothing has checked

- **Nobody looked at any page.** All UI work was tested in a browser and
  never seen. Each task entry names what a human should look at.
- **The database tests** (T16 onwards) never ran against the development
  server, only against CI's PostgreSQL.
- **No change was exercised against a production database.** There is none
  yet. Tonight's migrations have not been applied to `xenocats` (Q3).
- **Covered only by reading:** see "Tasks" above. That includes the fight
  under a real pointer lock on GitHub's runner (Q1).
