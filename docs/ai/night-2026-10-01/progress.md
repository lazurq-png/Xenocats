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
